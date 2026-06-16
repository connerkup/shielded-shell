# Archive branches

## `archive/devlog-full-history`

Snapshot of `main` **before** the public-beta history squash. Use this for devlogs, bisecting old work, or recovering granular commit messages.

```bash
git fetch origin archive/devlog-full-history
git log archive/devlog-full-history --oneline
git checkout archive/devlog-full-history   # detached or local branch
```

See [COMMIT_HISTORY.md](./COMMIT_HISTORY.md) for the commit index.

Public `main` is intentionally short; new work should branch from `main` and merge via PR.
