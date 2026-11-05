## 2024-11-05 - Replace execSync with execFileSync to prevent Command Injection
**Vulnerability:** Found uses of `execSync` with concatenated string inputs (like paths) which makes the code susceptible to command injection if paths are maliciously constructed.
**Learning:** `execSync` passes strings to the shell. The safe replacement is `execFileSync`, which receives an array of arguments, circumventing the shell layer entirely.
**Prevention:** Avoid string-based execution functions like `execSync` and `spawn` (with `shell: true`). Prefer using `execFileSync` and `spawnSync` with array-based arguments and explicit binary paths like `process.execPath`.
