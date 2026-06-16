---
title: Agent engines
description: Supported coding agent CLIs for shieldedshell loop.
---

`shieldedshell loop --engine <name>` dispatches to a headless, auto-approved invocation of each CLI. Run `shieldedshell doctor` to see **ready** vs missing on PATH.

## Supported engines

| Engine | Binary | Notes |
| --- | --- | --- |
| `claude` | `claude` | `--bare`, `acceptEdits` |
| `cline` | `cline` | Piped prompt, `--json`, `--auto-approve` |
| `aider` | `aider` | Phase-specific `--file` / `--read` |
| `openhands` | `openhands` | Headless CLI mode |
| `openhands-sdk` | `python` | Requires `pip install openhands-sdk` |
| `opencode` | `opencode` | `opencode run`, skip-permissions |
| `antigravity` | `agy` | Google Antigravity CLI |
| `copilot` | `copilot` | GitHub Copilot CLI |
| `cursor` | `cursor-agent` | Cursor agent CLI |
| `openclaw` | `openclaw` | OpenClaw agent |

## Setup snapshots

### Claude Code

Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code), authenticate once, then:

```bash
shieldedshell loop --engine claude --dir .
```

### Cline

```bash
npm i -g cline
cline auth
shieldedshell loop --engine cline --dir .
```

### Aider

Install from [aider.chat](https://aider.chat/). Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or your provider env vars.

### OpenHands

CLI: `uv tool install openhands` or see [OpenHands CLI docs](https://docs.openhands.dev/openhands/usage/cli/installation).

SDK: `pip install -U openhands-sdk openhands-tools` and `--engine openhands-sdk`.

### OpenCode

```bash
npm i -g opencode-ai
opencode auth login
shieldedshell loop --engine opencode --dir .
```

### GitHub Copilot CLI

```bash
npm i -g @github/copilot
copilot login
shieldedshell loop --engine copilot --dir .
```

Use only in isolated workspaces. ShieldedShell binds `--add-dir` to the loop workspace.

### Antigravity

Install via [Antigravity CLI docs](https://antigravity.google/docs/cli-overview), sign in on first run.

## Adding an engine

Prefer editing [Engine profiles](/reference/engine-profiles/) in `engine-profiles.ts` rather than one-off command builders. Open a PR with doctor expectations and a `loop.test.ts` assertion.
