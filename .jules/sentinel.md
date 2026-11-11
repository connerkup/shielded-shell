## 2026-11-11 - [CRITICAL] Command Injection via execSync
**Vulnerability:** The codebase was using `child_process.execSync` which invokes a shell, making it susceptible to command injection attacks if user inputs or environment variables are not properly sanitized.
**Learning:** `execSync` executes commands within a shell environment which automatically expands shell variables and parses metacharacters, a significant security risk for a local safety harness meant for potentially adversarial agents.
**Prevention:** Always use `child_process.execFileSync` instead. It does not spawn a shell by default, meaning arguments are passed exactly as provided without expansion or interpretation. Use array-based arguments and specifically `process.execPath` for node scripts.
