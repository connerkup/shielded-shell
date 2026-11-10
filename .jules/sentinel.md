## 2024-11-10 - Replace execSync with execFileSync to prevent command injection
**Vulnerability:** Use of `execSync` with dynamically constructed strings (e.g. `node --check "${tempFile}"`) is vulnerable to command injection if paths or inputs contain shell metacharacters.
**Learning:** `execSync` executes a string command via a shell by default, which introduces significant security risks in a CLI agent tool that handles dynamically generated files or paths. `execFileSync` avoids the shell and passes arguments directly, acting as a much safer alternative.
**Prevention:** Avoid string-based execution functions like `execSync`. Prefer using `execFileSync` with array-based arguments and `process.execPath`.
