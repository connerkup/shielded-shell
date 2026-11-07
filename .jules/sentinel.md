## 2024-05-24 - [CRITICAL] Prevent Command Injection via execSync
**Vulnerability:** Found `execSync` being used with string concatenation / interpolation for running node scripts (e.g., `execSync(\`node --check "${tempFile}"\`, { stdio: "pipe" });`). This is susceptible to command injection if `tempFile` contains shell metacharacters.
**Learning:** `execSync` passes the string to a shell, which can parse shell metacharacters.
**Prevention:** Avoid string-based execution functions like `execSync`. Prefer using `execFileSync` with array-based arguments and `process.execPath`. `execFileSync` is often a safer drop-in replacement than `spawnSync` because it throws on non-zero exit statuses and preserves the expected Error object signature.
