## 2023-10-31 - [Command Injection via execSync]
**Vulnerability:** Found `execSync` being used with string interpolation on variables like `tempFile` without sanitization, posing a command injection risk.
**Learning:** Standard library execution functions like `execSync` spawn shells and are inherently vulnerable to string interpolation attacks if paths or parameters have shell characters.
**Prevention:** Always use `spawnSync` (or `spawn`/`execFile`) with explicit array-based arguments and use `process.execPath` to ensure stable runtime execution without shell interpolation.
