---
title: Contributing
description: How to contribute to ShieldedShell during public beta.
---

ShieldedShell is open source on [GitHub](https://github.com/connerkup/shielded-shell). We welcome bug reports, engine profile fixes, docs improvements, and benchmark ideas.

## Development setup

```bash
git clone https://github.com/connerkup/shielded-shell.git
cd shielded-shell
npm install
npm test
npm run build
```

Docs site:

```bash
cd website
npm install
npm run dev
```

## Pull requests

1. Fork and branch from `main`.
2. Run `npm test` and `npm run build`.
3. For docs changes, run `npm run build` in `website/`.
4. Open a PR with how you tested (unit tests, `doctor`, live engine if applicable).

Full guide: [CONTRIBUTING.md on GitHub](https://github.com/connerkup/shielded-shell/blob/main/CONTRIBUTING.md).

## History

Public `main` is a squashed beta tree. Granular commit history is on branch [`archive/devlog-full-history`](https://github.com/connerkup/shielded-shell/tree/archive/devlog-full-history).

## Security

Report vulnerabilities privately. See [SECURITY.md](https://github.com/connerkup/shielded-shell/blob/main/SECURITY.md).

## Links

- [Issues](https://github.com/connerkup/shielded-shell/issues)
- [Bug report template](https://github.com/connerkup/shielded-shell/issues/new?template=bug_report.yml)
- [Feature request template](https://github.com/connerkup/shielded-shell/issues/new?template=feature_request.yml)
