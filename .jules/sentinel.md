## 2025-02-14 - Replace execSync with execFileSync
**Vulnerability:** Found uses of string-based command execution (`execSync`) which is vulnerable to command injection if untrusted input is passed in the string.
**Learning:** `execSync` relies on a shell (or shell-like parsing) which can lead to command injection.
**Prevention:** Always use `execFileSync` (or `spawnSync`) with array-based arguments and `process.execPath` to ensure arguments are passed directly to the executable without shell parsing.
