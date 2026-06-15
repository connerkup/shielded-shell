# Releasing to npm

Packages:

- `@shieldedshell/core` — library, bundled `prompts/` and `scripts/`
- `@shieldedshell/cli` — global `shieldedshell` binary

## Public beta (default)

```bash
npm run pack:check          # dry-run tarballs
npm run publish:npm -- --otp=XXXXXX
```

Publishes with `--access public --tag beta`. Requires npm 2FA OTP on publish (`auth-and-writes`).

Install test:

```bash
npm install -g @shieldedshell/cli@beta
shieldedshell doctor
```

## Private org packages

Private scoped publishes require **npm Teams billing on the `@shieldedshell` org**, not personal Pro alone.

```bash
npm run publish:npm:private -- --otp=XXXXXX
```

## Version bumps

1. Bump `version` in `packages/core/package.json` and `packages/cli/package.json` (keep in sync).
2. Update `CHANGELOG.md`.
3. Tag on GitHub: `git tag v0.1.1 && git push origin v0.1.1`.
4. Publish both packages; promote `latest` when ready.

## GitHub release

After tag push, create a release on GitHub with notes from `CHANGELOG.md` so beta testers can follow changes without reading npm only.
