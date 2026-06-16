---
title: CLI commands
description: ShieldedShell command reference.
---

## Global options

Many commands accept:

| Option | Description |
| --- | --- |
| `-d, --dir <path>` | Workspace directory (default: current directory) |
| `-c, --config <path>` | Path to `shield.yaml` |

## `shieldedshell init`

Create a default `shield.yaml` in the current directory.

```bash
shieldedshell init
shieldedshell init --force   # overwrite existing
```

## `shieldedshell doctor`

Print environment diagnostics: Node version, config path, engine readiness.

```bash
shieldedshell doctor
```

## `shieldedshell run`

Run a command inside the sandboxed workspace.

```bash
shieldedshell run node ./script.mjs
shieldedshell --dir ./my-project run npm test
```

Use `--` before arguments if flags would confuse the parser.

## `shieldedshell shell`

Interactive shell with workspace binding and overlay.

```bash
shieldedshell shell
```

## `shieldedshell verify`

Static safety checks without running agents.

```bash
shieldedshell verify --type ledger --balances '...' --transfers '...'
shieldedshell verify --type routing --policies '...' --routes '...'
```

## `shieldedshell loop`

Dual-agent loop with engine dispatch and prompt templates.

```bash
shieldedshell loop --engine cline --benchmark 02_ledger_consensus --dir .
shieldedshell loop --engine cursor --dir .
```

| Option | Description |
| --- | --- |
| `-e, --engine <name>` | Agent engine (required) |
| `--benchmark <name>` | Benchmark folder under `./benchmark` |
| `--target <path>` | Merge target file (default: `auth_service.js`) |

## `shieldedshell orchestrate`

Dual-agent loop with explicit dev/audit shell commands.

```bash
shieldedshell orchestrate \
  --dev "node ./agents/dev.mjs" \
  --audit "node ./agents/audit.mjs" \
  --dir .
```

## `shieldedshell reconcile`

Run the reconciler gate on current JSON buffers (without spawning agents).

```bash
shieldedshell reconcile --dir .
```

## `@shieldedshell/core` (library)

Programmatic APIs for sandbox, policy, reconcile, and orchestration:

```ts
import {
  runCommandSync,
  orchestrateDualAgentLoop,
  buildLoopCommands,
  loadConfig,
} from '@shieldedshell/core';
```

See the [GitHub repo](https://github.com/connerkup/shielded-shell/tree/main/packages/core) for exports.
