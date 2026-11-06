## 2024-05-15 - Command Injection via execSync in Reconciler
**Vulnerability:** The `reconcile` function in `packages/core/src/reconcile.ts` uses `execSync(\`node --check "\${tempFile}"\`, { stdio: "pipe" })` which is vulnerable to command injection if `tempFile` (derived from the workspace path) contains shell metacharacters. Similarly, `loop.test.ts` uses `execSync` with unsanitized paths.
**Learning:** Using string interpolation with `execSync` or `spawn` with `shell: true` introduces command injection risks when paths or arguments are not strictly controlled.
**Prevention:** Always use `execFileSync` (or `spawnSync` with `shell: false`) with array-based arguments and `process.execPath` instead of `execSync` or string commands.
