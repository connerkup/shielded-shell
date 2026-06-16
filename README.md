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
| `shieldedshell loop --engine <name> [--benchmark NAME]` | Dual-agent loop (`claude`, `cline`, `aider`, `openhands`, `opencode`, `antigravity`, `copilot`, …) |
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
shieldedshell loop --engine claude --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine cline --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine aider --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine openhands --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine opencode --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine antigravity --benchmark 02_ledger_consensus --dir ./my-project
shieldedshell loop --engine copilot --benchmark 02_ledger_consensus --dir ./my-project
```

Supported engines: `claude`, `cline`, `aider`, `openhands`, `openhands-sdk`, `opencode`, `antigravity`, `copilot`, `cursor`, `openclaw`. Prompts live in `prompts/` or `benchmark/<name>/agent_*_prompt.txt`.

**Adding or tuning engines:** loop dispatch is data-driven in `packages/core/src/engine-profiles.ts`. Each profile declares the binary, how the prompt is delivered (`pipe-file`, `inline-prompt`, or `script`), headless/auto-approve flags, workspace binding, and optional phase file attachments. The shared `LOOP_TOOL_HINT` and 15-minute agent timeout apply to all engines — no per-engine TypeScript patches required for new CLIs that fit those patterns.

Run `shieldedshell doctor` for **ready** vs **not on PATH** / missing SDK import (e.g. `openhands-sdk` checks `python -c "import openhands.sdk"`).

### Claude Code

1. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and sign in once (`claude auth login` or follow the installer).
2. From your project folder, run `shieldedshell doctor` and confirm `claude: found`.
3. Run a benchmark loop:

```bash
shieldedshell loop --engine claude --benchmark 02_ledger_consensus --dir .
```

Claude runs in `--bare` mode with `acceptEdits` so file writes land in the workspace JSON buffers without extra approval prompts each turn.

### Cline (open source)

1. Install globally: `npm i -g cline`
2. Authenticate once: `cline auth` ([Authorization guide](https://docs.cline.bot/getting-started/authorizing-with-cline))
3. Confirm with `shieldedshell doctor` (`cline: found`)
4. Run the same benchmark:

```bash
shieldedshell loop --engine cline --benchmark 02_ledger_consensus --dir .
```

Cline runs with `--auto-approve true`, workspace binding via `-c`, and a 15-minute per-agent timeout (`-t 900`). Increase `sandbox.cpu_timeout_ms` in `shield.yaml` if orchestrator kills long runs early.

The [Cline SDK](https://docs.cline.bot/sdk/overview) (`@cline/sdk`) embeds the same agent runtime programmatically; ShieldedShell loop mode uses the CLI today for parity with other engines. SDK-native embedding is a natural Phase 3 extension for custom harnesses.

### Aider (open source, terminal pair programmer)

1. Install: [aider.chat](https://aider.chat/) — `python -m pip install -aider-install` then `aider-install`, or `pip install aider-chat`
2. Set a model API key (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or provider-specific vars). Optional: `AIDER_MODEL` in `.env` or the workspace environment.
3. Confirm with `shieldedshell doctor` (`aider: found`)
4. Run the benchmark:

```bash
shieldedshell loop --engine aider --benchmark 02_ledger_consensus --dir .
```

Aider runs one-shot via `--message` with `--yes-always`. Each loop phase binds `--file` to the correct JSON buffer (`developer_output.json` or `auditor_output.json`) and `--read` for shared context plus the other agent's output. Git auto-commits and shell-command suggestions are disabled so the harness stays in control.

### OpenHands (open source, MIT)

OpenHands powers the same agent runtime as the [Software Agent SDK](https://docs.openhands.dev/sdk). ShieldedShell supports two loop engines:

**CLI (recommended):** `loop --engine openhands`

1. Install the CLI: `uv tool install openhands --python 3.12` or the [install script](https://docs.openhands.dev/openhands/usage/cli/installation)
2. Configure LLM credentials in `~/.openhands/agent_settings.json`, or export `LLM_API_KEY` / `LLM_MODEL` and use `--override-with-envs` (wired automatically)
3. On native Windows, OpenHands expects [WSL Ubuntu](https://docs.openhands.dev/openhands/usage/cli/installation); run ShieldedShell from that environment
4. Run:

```bash
shieldedshell loop --engine openhands --benchmark 02_ledger_consensus --dir .
```

Headless mode auto-approves tool use (`--headless`, `--exit-without-confirmation`).

**SDK (Python):** `loop --engine openhands-sdk`

1. `pip install -U openhands-sdk openhands-tools`
2. Set `LLM_API_KEY` (and optional `LLM_MODEL`, `LLM_BASE_URL`)
3. Run:

```bash
shieldedshell loop --engine openhands-sdk --benchmark 02_ledger_consensus --dir .
```

This invokes `scripts/openhands-loop.py`, a thin wrapper around `Conversation.run()` from the SDK.

### OpenCode (open source)

1. Install: `npm i -g opencode-ai` (or see [opencode.ai/docs/cli](https://opencode.ai/docs/cli))
2. Authenticate: `opencode auth login`
3. Confirm with `shieldedshell doctor` (`opencode: found`)
4. Run:

```bash
shieldedshell loop --engine opencode --benchmark 02_ledger_consensus --dir .
```

Uses `opencode run` with `--dangerously-skip-permissions`, workspace `--dir`, and phase-specific `-f` attachments for JSON buffers and shared context.

### Antigravity (Google)

1. Install the CLI: `irm https://antigravity.google/cli/install.ps1 | iex` (Windows) or [install.sh](https://antigravity.google/docs/cli-overview) (macOS/Linux)
2. Sign in on first `agy` launch
3. Confirm with `shieldedshell doctor` (`antigravity: agy found`)
4. Run:

```bash
shieldedshell loop --engine antigravity --benchmark 02_ledger_consensus --dir .
```

Uses `agy -p` print mode with `--dangerously-skip-permissions` for unattended loop turns. Same agent harness as Antigravity 2.0 IDE.

### GitHub Copilot (VS Code subscription / CLI)

Uses the [GitHub Copilot CLI](https://docs.github.com/copilot/concepts/agents/about-copilot-cli) — the terminal agent that shares your Copilot subscription (including classic VS Code Copilot).

1. Install: `npm install -g @github/copilot`
2. Authenticate: `copilot login`
3. Confirm with `shieldedshell doctor` (`copilot: found`)
4. Run:

```bash
shieldedshell loop --engine copilot --benchmark 02_ledger_consensus --dir .
```

Uses programmatic mode (`-p`) with `--allow-all-tools` and `--add-dir` bound to the loop workspace. Use only in isolated workspaces; ShieldedShell already constrains the working directory.

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
