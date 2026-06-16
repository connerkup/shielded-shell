# GitHub repository security

Controls applied to [connerkup/shielded-shell](https://github.com/connerkup/shielded-shell). Solo-maintainer public beta: balance safety with velocity.

## Enabled on the remote

| Control | Purpose |
| --- | --- |
| **Branch ruleset (`main`)** | No force-push; PR + green CI required to merge |
| **Required checks** | `test (20)`, `test (22)`, `test-windows`, `website`, `analyze` |
| **Dependabot alerts** | Known CVEs in npm dependencies |
| **Dependabot security updates** | Auto-PRs for security patches |
| **Dependabot version updates** | Weekly npm update PRs (`.github/dependabot.yml`) |
| **Dependency review** | Blocks PRs introducing high-severity deps |
| **CodeQL** | Static analysis on push/PR + weekly schedule |
| **CODEOWNERS** | Review routing for `.github/`, packages, website |
| **Fork PR approval** | Public repos: first-time contributors need maintainer approval before fork workflows run (GitHub default). Tighten under **Settings → Actions → General** if needed. |
| **Secret scanning + push protection** | Enabled on the public repo (GitHub default for public) |
| **Minimal Actions token** | CI workflows use `permissions: contents: read` only; default workflow token is read-only |
| **Delete branch on merge** | Enabled |

## Vulnerability reports

See [SECURITY.md](../SECURITY.md) for coordinated disclosure (not public issues).

## Maintainer checklist (manual / periodic)

- [ ] Review Dependabot and CodeQL alerts weekly
- [ ] Rotate npm publish OTP / tokens if exposed
- [ ] Confirm Cloudflare Pages deploy token is scoped to this repo only
- [ ] Audit GitHub org members with admin on `@shieldedshell` npm org

## Re-applying branch protection

Ruleset is repo metadata (not in git). If deleted, recreate from `.github/rulesets/main-protection.json`:

```powershell
gh api --method POST repos/connerkup/shielded-shell/rulesets --input .github/rulesets/main-protection.json
```

Or use GitHub UI **Rules → Rulesets → Import**.

## Direct pushes to `main`

The ruleset requires pull requests. Use a branch + PR even for solo work so CI and dependency review run before merge.
