## 2026-11-08 - Prevent Command Injection via execSync
**Vulnerability:** Use of string-based execution functions like `execSync` which are prone to command injection, especially when using template literals with unsanitized paths.
**Learning:** Even internal tool execution or paths derived from workspace config could theoretically contain malicious payloads.
**Prevention:** Avoid string-based execution functions like `execSync`. Prefer using `execFileSync` with array-based arguments and `process.execPath` to ensure arguments are treated as arguments, not executable shell segments.
