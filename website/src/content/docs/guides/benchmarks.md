---
title: Benchmarks
description: Consensus scenarios for validating dual-agent loops.
---

Benchmarks live in the [GitHub repo](https://github.com/connerkup/shielded-shell/tree/main/benchmark). They are **not** bundled on npm. Copy a folder into your project before running `shieldedshell loop --benchmark <name>`.

## Copy a benchmark

```bash
git clone https://github.com/connerkup/shielded-shell.git
cp -r shielded-shell/benchmark/02_ledger_consensus ./benchmark/
```

Windows PowerShell:

```powershell
Copy-Item -Recurse shielded-shell\benchmark\02_ledger_consensus .\benchmark\
```

## Available scenarios

| Name | Focus |
| --- | --- |
| `02_ledger_consensus` | Concurrent ledger transfers; interval solver + secure validator |
| `04_api_gateway` | Routing policy; sensitive paths must not map to public gateways |
| `06_poison_task` | Adversarial / poison detection scenario (expects controlled failure modes) |

Each folder includes:

- `agent_a_prompt.txt` / `agent_b_prompt.txt` — role prompts
- `developer_secret.txt` / `auditor_secret.txt` — phase-gated fixture data
- `validate.js` — secure validator (where applicable)

## Run a benchmark

```bash
cd your-project
shieldedshell init
shieldedshell loop --engine cline --benchmark 02_ledger_consensus --dir .
```

Success ends with `CRITICAL_SUCCESS` in `shared_context.txt` and merged code in the merge target (default `auth_service.js`).

## Mock agents (CI / local dev)

The repo includes mock agent scripts under `packages/core/fixtures/` for automated tests without live LLMs. See the GitHub repo for `mock-dev-ledger.mjs` and `mock-audit-pass.mjs` patterns.

## Report issues

Beta feedback: [bug report template](https://github.com/connerkup/shielded-shell/issues/new?template=bug_report.yml). Include `shieldedshell doctor` output and engine name.
