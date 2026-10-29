## 2025-02-09 - Avoid execSync for paths controlled by workspace inputs
**Vulnerability:** Command injection vulnerability via `execSync` when executing dynamically generated workspace files. The `tempFile` was generated dynamically in `.shieldedshell/state/temp_check.js` which depended on `options.workspace`, allowing command injection.
**Learning:** `execSync` runs in a shell by default or executes a string as a command, opening the possibility for command injection even for paths that look safe but are controlled by external inputs or environment locations.
**Prevention:** Use `spawnSync` from `node:child_process` with an array-based argument list and `process.execPath` to launch node, removing the shell execution risk.
