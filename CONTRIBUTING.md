# Contributing to ShieldedShell

Thanks for helping test and build ShieldedShell. This repo is in **public beta** — we welcome bug reports, engine profile fixes, docs improvements, and benchmark ideas.

## Before you start

1. Install Node.js **20+**.
2. Fork and clone [github.com/connerkup/shielded-shell](https://github.com/connerkup/shielded-shell).
3. From the repo root:

```bash
npm install
npm test
npm run build
```

Optional smoke check:

```bash
npm run shieldedshell -- doctor
npm run shieldedshell -- run node -e "console.log('ok')"
```

## What to work on

| Area | Path | Good first tasks |
| --- | --- | --- |
| Engine profiles | `packages/core/src/engine-profiles.ts` | Fix headless flags for a CLI, add a new engine profile |
| Loop / orchestration | `packages/core/src/orchestrator.ts`, `loop.ts` | Timeouts, phase locks, error messages |
| CLI | `packages/cli/src/index.ts` | UX, `doctor` checks, help text |
| Benchmarks | `benchmark/` | New consensus scenarios, validators |
| Docs | `README.md`, `docs/` | Clarify setup steps, engine auth |

See [engine profiles](packages/core/src/engine-profiles.ts) before adding per-engine TypeScript — prefer data-driven profiles.

## History

Public `main` is intentionally squashed for a clean beta tree. Full granular commits (MVP through public beta prep) are on **`archive/devlog-full-history`**. Index: `docs/archive/COMMIT_HISTORY.md`.

## Pull requests

1. Open an issue for large changes (new engine, architecture shift).
2. Keep diffs focused; match existing TypeScript style.
3. Run `npm test` and `npm run build` before pushing.
4. Describe how you tested (unit tests, `doctor`, live engine if applicable).

## Reporting bugs

Use the [bug report template](https://github.com/connerkup/shielded-shell/issues/new/choose). Include:

- OS and Node version (`node -v`)
- `shieldedshell doctor` output
- Engine name and command (redact API keys)
- Expected vs actual behavior

## Releases (maintainers)

See [docs/RELEASING.md](docs/RELEASING.md).

## Code of conduct

Be direct and respectful. Security issues: see [SECURITY.md](SECURITY.md).
