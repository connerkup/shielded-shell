## 2024-05-24 - [Command Injection] Replace execSync with spawnSync
**Vulnerability:** Found `execSync` being used with string concatenation in `reconcile.ts` and `loop.test.ts`. This poses a command injection risk, especially if variables like `tempFile` contain spaces or malicious shell characters.
**Learning:** Avoid using shell execution functions like `execSync` with dynamically constructed strings. Even with careful escaping, it's error-prone.
**Prevention:** Always use `spawnSync` (or `spawn`) with an array of arguments, which bypasses the shell and prevents command injection. Also prefer using `process.execPath` instead of relying on `"node"` being in the `PATH`.
