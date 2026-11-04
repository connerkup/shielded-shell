## 2025-03-01 - Prevent Command Injection with execFileSync
**Vulnerability:** Command injection risk using `execSync` string commands with user-controlled input (`tempFile`).
**Learning:** `execSync(commandString)` executes via a shell by default, rendering any dynamically inserted input vulnerable to command injection payloads. `execFileSync` requires array arguments and avoids the shell parsing, effectively thwarting command injections.
**Prevention:** Instead of `execSync(\`node "\${variable}"\`)`, always prefer `execFileSync(process.execPath, [variable])`.