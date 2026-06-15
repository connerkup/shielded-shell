# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-06-16

### Added

- Public beta on npm: `@shieldedshell/cli` and `@shieldedshell/core` (tag `beta` / `latest`).
- CLI commands: `init`, `run`, `shell`, `verify`, `orchestrate`, `loop`, `reconcile`, `doctor`.
- Dual-agent loop with declarative engine profiles for Claude Code, Cline, Aider, OpenHands, OpenHands SDK, OpenCode, Antigravity, Copilot, Cursor, and OpenClaw.
- Workspace sandbox: copy-on-write overlay, policy intercept log, blocked secret paths, network off by default.
- Bounded static solvers (interval ledger + Datalog routing) and reconciler gate.
- Benchmark fixtures under `benchmark/` for loop validation.

### Notes

- Beta: APIs and CLI flags may change before 1.0.
- Loop benchmarks expect fixture files copied into your project workspace; see README.

[0.1.0]: https://github.com/connerkup/shielded-shell/releases/tag/v0.1.0
