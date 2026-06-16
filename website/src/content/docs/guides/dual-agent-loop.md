---
title: Dual-agent loop
description: Developer and auditor agents with reconciler gates and engine dispatch.
---

The dual-agent loop runs two roles in alternation:

1. **Developer** — drafts code into `developer_output.json`
2. **Auditor** — reviews and records kill criteria in `auditor_output.json`
3. **Reconciler** — validates JSON, runs static checks, merges approved code when gates pass

Shared state lives in `shared_context.txt` and JSON buffer files in the workspace.

## Run with an engine

Install an agent CLI and confirm with `shieldedshell doctor`, then:

```bash
shieldedshell loop --engine cline --benchmark 02_ledger_consensus --dir .
```

Other engines use the same pattern:

```bash
shieldedshell loop --engine claude --benchmark 02_ledger_consensus --dir .
shieldedshell loop --engine aider --benchmark 02_ledger_consensus --dir .
shieldedshell loop --engine openhands --benchmark 02_ledger_consensus --dir .
```

See [Agent engines](/reference/engines/) for setup per CLI.

## Explicit commands (no engine profile)

Bring your own scripts:

```bash
shieldedshell orchestrate \
  --dev "node ./agents/dev.mjs" \
  --audit "node ./agents/audit.mjs" \
  --benchmark 02_ledger_consensus \
  --dir ./my-project
```

## Workspace files

| File | Role |
| --- | --- |
| `shared_context.txt` | Task header and loop status |
| `developer_output.json` | Developer JSON (code, explanation, query) |
| `auditor_output.json` | Auditor JSON (verdict, kill criteria) |
| `auth_service.js` (or `--target`) | Merge target when reconciler approves |

`shieldedshell init` creates empty buffers if missing.

## Phase locks

During each agent turn, ShieldedShell locks files the active role must not write (for example the auditor cannot edit `developer_output.json` mid-turn). This reduces cross-contamination between roles.

## Reconciler gate

After each iteration the reconciler:

- Parses agent JSON output
- Runs syntax and static verification (benchmark-specific when `--benchmark` is set)
- Merges approved code into the target file on success
- Appends status to `shared_context.txt`

Loop exits on `CRITICAL_SUCCESS` or after `auto_heal.max_retry_cycles` (default 5).

## Benchmark secrets

Benchmarks may expose role-specific secrets only during the matching phase (for example auditor-only fixture data). Secrets are hidden again after the turn.

## Timeouts

Agent CLI runs use a **minimum 15-minute** orchestrator timeout so slow LLM turns are not killed at the default 5-minute sandbox limit. Per-engine flags (for example Cline `-t 900`) are set from [engine profiles](/reference/engine-profiles/).

## Related

- [Benchmarks](/guides/benchmarks/) — copy fixtures into your workspace
- [Engine profiles](/reference/engine-profiles/) — how headless dispatch works
