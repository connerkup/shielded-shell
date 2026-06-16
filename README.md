# ShieldedShell (shieldedshell.com)

Zero-trust local safety harness and multi-agent consensus orchestrator for CLI coding agents (Claude Code, Cursor CLI, Aider, Cline, and custom loops).

## Quick start

```bash
npm install
npm run build
npm run shieldedshell -- init
npm run shieldedshell -- doctor
npm run shieldedshell -- run node -e "console.log('hello from sandbox')"
```

Install globally after build:

```bash
npm link
shieldedshell run "echo safe"
```

## Commands

| Command | Purpose |
| --- | --- |
| `shieldedshell init` | Create `shield.yaml` policy in the current directory |
| `shieldedshell run <cmd...>` | Run a command in a sandboxed workspace with intercept logging |
| `shieldedshell shell` | Interactive shell bound to workspace + overlay |
| `shieldedshell verify --type ledger\|routing` | Static interval / Datalog safety checks |
| `shieldedshell orchestrate --dev ... --audit ...` | Dual-agent loop with explicit commands |
| `shieldedshell loop --engine cursor [--benchmark NAME]` | Dual-agent loop with prompt templates + engine dispatch |
| `shieldedshell reconcile` | Run reconciler gate on current buffers |

## Example

```bash
shieldedshell --dir ./my-project run node ./scripts/agent-task.mjs
```

Typical intercept output:

```text
[ShieldedShell] Blocked READ: C:/Users/me/.ssh/id_rsa (policy)
[ShieldedShell] Allowed EXEC: node ./scripts/agent-task.mjs
```

## Repository layout

```text
shielded-shell/
├── packages/
│   ├── core/          @shieldedshell/core — solvers, policy, overlay, reconcile
│   └── cli/           shieldedshell CLI
├── bounded-solvers-rs/ Rust reference solvers (optional fast path)
├── bounded_solvers.js  Legacy JS solvers (reference)
├── docs/               Architecture and product specs
└── examples/shield.yaml
```

## Architecture (MVP)

Phase 1 ships the CLI harness:

1. Workspace binding via `shield.yaml`
2. Copy-on-write overlay (`.shieldedshell/overlay/`)
3. Policy intercept log (blocked reads, risky exec patterns, network off by default)
4. Bounded static solvers (interval ledger + Horn-clause Datalog routing)
5. Reconciler gate + dual-agent orchestration (ported from `my-agent-loop`)

Future: native Go single-binary packaging, PTY interception, and network proxy gate (see `docs/shieldedshell_architecture.md`).

## Static solvers

```bash
npm run shieldedshell -- verify --type ledger \
  --balances '{"Alice":[500,500],"Bob":[50,50]}' \
  --transfers '[{"from":"Alice","to":"Bob","amount":600}]'

npm run shieldedshell -- verify --type routing \
  --policies '{"/api/v1/billing":"Public"}' \
  --routes '{"/api/v1/billing":"http://billing"}'
```

Rust solvers (optional):

```bash
cd bounded-solvers-rs
cargo build --release
```

## Dual-agent orchestration

Explicit commands:

```bash
shieldedshell orchestrate \
  --dev "node ./agents/dev.mjs" \
  --audit "node ./agents/audit.mjs" \
  --benchmark 02_ledger_consensus \
  --dir ./my-project
```

Engine + prompts (matches legacy `orchestrator.ps1` flow):

```bash
shieldedshell loop --engine cursor --benchmark 02_ledger_consensus --dir ./my-project
```

Supported engines: `cursor`, `aider`, `openclaw`, `cline`. Prompts live in `prompts/` or `benchmark/<name>/agent_*_prompt.txt`.

## Documentation

- Product MVP: `docs/mvp_product_strategy.md`
- Terminal virtualization target: `docs/shieldedshell_architecture.md`
- npm/API patterns: `docs/npm_integration_guide.md`
- Dual-agent loop: `docs/dual_agent_automator.md`
- Productization spec: `docs/PRODUCTIZATION_SPEC.md`

## Development

```bash
npm test
npm run build
```

## License

MIT
