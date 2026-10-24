## 2026-10-24 - [Command Injection via execSync in Reconciler]
**Vulnerability:** Use of execSync with a dynamically constructed string containing a file path.
**Learning:** File paths can contain shell metacharacters which could lead to command injection if passed directly to execSync.
**Prevention:** Always use spawnSync with an array of arguments, avoiding the use of a shell where possible.
