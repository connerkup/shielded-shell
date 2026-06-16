---
title: Sandbox and policy
description: Workspace binding, overlay, intercept log, and shield.yaml policy.
---

ShieldedShell's core job is to make agent side effects **legible and bounded** before they hit your real filesystem or network.

## Workspace binding

Every command runs against a **workspace directory** (usually your project root). Policy in `shield.yaml` controls:

- Which paths agents may read or write
- Whether network access is allowed
- CPU timeout and memory limits
- Copy-on-write overlay behavior

```bash
shieldedshell --dir ./my-project run node ./scripts/task.mjs
```

## Copy-on-write overlay

When `sandbox.overlay_enabled` is true (default), writes go to `.shieldedshell/overlay/` first. Your working tree stays clean until you explicitly merge approved changes.

## Intercept log

All policy decisions print to the terminal with a consistent prefix:

```text
[ShieldedShell] Blocked READ: ~/.aws/credentials (policy)
[ShieldedShell] Allowed EXEC: node ./scripts/task.mjs
[ShieldedShell] Allowed AUDIT: Syntax check passed
```

This is the primary "aha" for daily agent use: you see what would have happened before it happens.

## Blocked paths

Default policy blocks reads of common secret locations:

- `~/.ssh/**`
- `~/.aws/**`
- `**/.env` and `**/.env.*`

Writes to `.git/**` are blocked by default. Customize globs in [Configuration](/reference/configuration/).

## Network

`sandbox.allow_network` defaults to **false** for sandboxed `run` commands. Agent loop runs use `networkPolicy: agent` so LLM CLIs can reach their APIs while still respecting workspace rules.

## Agent runs vs sandbox runs

| Mode | Command | Network | Typical use |
| --- | --- | --- | --- |
| Sandbox | `shieldedshell run …` | Off (default) | Scripts, validators, local tools |
| Agent | `shieldedshell loop …` | On for agent CLIs | Developer / auditor agent turns |

## Static solvers

Before merging code from a dual-agent loop, the reconciler can run:

- **Interval ledger solver** — no negative balances under concurrent transfers
- **Datalog routing solver** — sensitive routes stay off public gateways

Enable invariants in `shield.yaml` or use `shieldedshell verify` directly. See [CLI commands](/reference/commands/).

## Related

- [Configuration](/reference/configuration/) — full `shield.yaml` reference
- [Dual-agent loop](/guides/dual-agent-loop/) — orchestration on top of the sandbox
