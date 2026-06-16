---
title: Configuration
description: shield.yaml policy reference.
---

Run `shieldedshell init` to create a starter file. Example from the repo:

```yaml
version: "1.0"

sandbox:
  workspace_dir: "."
  allow_network: false
  allowed_domains: []
  max_memory_mb: 256
  cpu_timeout_ms: 300000
  overlay_enabled: true

invariants:
  ledger:
    enabled: false
    min_balance: 0.0
  routing:
    enabled: false
    allow_sensitive_public: false

auto_heal:
  max_retry_cycles: 5
  model: "claude-3-5-sonnet"

paths:
  blocked_read_globs:
    - "~/.ssh/**"
    - "~/.aws/**"
    - "**/.env"
    - "**/.env.*"
  blocked_write_globs:
    - "**/.git/**"
```

## `sandbox`

| Key | Default | Description |
| --- | --- | --- |
| `workspace_dir` | `.` | Root for containment and overlay |
| `allow_network` | `false` | Network for sandboxed `run` (not agent loop) |
| `allowed_domains` | `[]` | Allowlist when network is on |
| `max_memory_mb` | `256` | Memory hint for policy |
| `cpu_timeout_ms` | `300000` | Timeout for sandboxed commands (5 min) |
| `overlay_enabled` | `true` | Copy-on-write overlay |

Agent loop runs use at least **900000 ms** (15 min) regardless of this value.

## `invariants`

Enable static solvers during reconcile:

- **ledger** — interval arithmetic on balances and transfers
- **routing** — Datalog check that sensitive routes are not public

## `auto_heal`

| Key | Description |
| --- | --- |
| `max_retry_cycles` | Max dual-agent loop iterations |
| `model` | Reserved for future auto-heal prompts |

## `paths`

Glob patterns for blocked reads and writes. Tilde expands to the user home directory.

## Config discovery

ShieldedShell walks up from the workspace for `shield.yaml`. Override with `-c /path/to/shield.yaml`.

## Example in repo

Full example: [examples/shield.yaml on GitHub](https://github.com/connerkup/shielded-shell/blob/main/examples/shield.yaml).
