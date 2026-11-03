## 2025-02-14 - Replace execSync with execFileSync for Safe Execution
**Vulnerability:** The `execSync` function in `node:child_process` uses a shell by default, which can lead to command injection if input parameters are not properly sanitized. This was present in the `reconcile.ts` engine core and tests.
**Learning:** Even internal tooling or test environments require careful handling of shell executions to prevent unforeseen escalation vectors. `execFileSync` avoids invoking a shell by directly running the executable.
**Prevention:** Avoid string-based execution functions like `execSync`. Always use `execFileSync` (or `spawnSync`) with array-based arguments and specifically address the executable path, like `process.execPath`, to enforce execution safety.
