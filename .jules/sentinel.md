## 2025-02-18 - Fix Command Injection in Child Process Execution
**Vulnerability:** Shell/Command injection risk due to string-based commands passed to `execSync()`.
**Learning:** Hardcoded string concatenation with dynamic inputs for child process execution (like paths and files) can be leveraged to inject arbitrary shell commands. The codebase had this pattern in `reconcile.ts` and `loop.test.ts`.
**Prevention:** Use `execFileSync()` with array-based arguments and `process.execPath` to explicitly run the required binary and safely pass arguments.
