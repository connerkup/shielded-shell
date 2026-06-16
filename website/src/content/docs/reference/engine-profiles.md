---
title: Engine profiles
description: Data-driven agent CLI dispatch for shieldedshell loop.
---

Loop commands are built from declarative profiles in `packages/core/src/engine-profiles.ts`. Each profile specifies:

- **Binary** (with optional Windows alias)
- **Prompt delivery** — `pipe-file`, `inline-prompt`, or `script`
- **Headless / auto-approve flags**
- **Workspace binding** (`-c`, `--dir`, `--add-dir`, or cwd-only)
- **Phase file attachments** (developer vs auditor read/write targets)
- **Doctor checks** — PATH lookup or Python import

## Shared contract

All engines receive the same append hint (`LOOP_TOOL_HINT`): write JSON to the designated buffer file, not chat-only output.

Orchestrator agent timeout: **15 minutes minimum** (`DEFAULT_AGENT_TIMEOUT_MS`).

## Delivery modes

| Mode | Used by | Behavior |
| --- | --- | --- |
| `pipe-file` | Cline | `cat prompt \| cline …` with JSON headless flags |
| `inline-prompt` | Claude, Aider, Copilot, … | Full prompt on command line with tool hint |
| `script` | `openhands-sdk` | Python wrapper `scripts/openhands-loop.py` |

## Phase files

Aider and OpenCode attach workspace files per role:

- **Developer** writes `developer_output.json`, reads shared context + auditor output
- **Auditor** writes `auditor_output.json`, reads shared context + developer output

## Example profile (conceptual)

```ts
cline: {
  id: "cline",
  binary: "cline",
  delivery: "pipe-file",
  headlessArgs: ["--json"],
  autoApproveArgs: ["--auto-approve", "true"],
  workspace: { mode: "flag", flag: "-c" },
  timeoutFlag: "-t",
}
```

## Adding a new engine

1. Copy the closest existing profile in `ENGINE_PROFILES`.
2. Adjust binary, delivery mode, and flags to match the CLI's headless docs.
3. Add expectations in `engine-profiles.test.ts` and `loop.test.ts`.
4. Document setup in [Agent engines](/reference/engines/).

No new TypeScript builder functions are required unless you introduce a new delivery mode.

## Maintainer note

Source of truth: [engine-profiles.ts on GitHub](https://github.com/connerkup/shielded-shell/blob/main/packages/core/src/engine-profiles.ts).
