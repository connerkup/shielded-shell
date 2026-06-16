---
title: Installation
description: Install ShieldedShell from npm or build from source.
---

## npm (recommended)

Requires **Node.js 20+**.

```bash
npm install -g @shieldedshell/cli@beta
```

Verify:

```bash
shieldedshell --version
shieldedshell doctor
```

Library only (embed in your own Node app):

```bash
npm install @shieldedshell/core
```

## Initialize a workspace

In your project directory:

```bash
shieldedshell init
```

Creates `shield.yaml` with sensible defaults (workspace binding, overlay, blocked secret paths).

## From source

For contributors or pre-release builds:

```bash
git clone https://github.com/connerkup/shielded-shell.git
cd shielded-shell
npm install
npm run build
npm link -w @shieldedshell/cli
shieldedshell doctor
```

## Agent engines

ShieldedShell orchestrates **your** coding agent CLIs. Install at least one engine separately, for example:

| Engine | Typical install |
| --- | --- |
| Cline | `npm i -g cline` then `cline auth` |
| Aider | [aider.chat](https://aider.chat/) install docs |
| OpenCode | `npm i -g opencode-ai` |
| Claude Code | [Anthropic Claude Code](https://docs.anthropic.com/en/docs/claude-code) |
| Copilot CLI | `npm i -g @github/copilot` |

Run `shieldedshell doctor` to see which engines are **ready** on your PATH. See [Agent engines](/reference/engines/) for the full list.

## Next steps

- [Quick start](/getting-started/quick-start/) — first sandboxed command
- [Dual-agent loop](/guides/dual-agent-loop/) — developer + auditor benchmark
