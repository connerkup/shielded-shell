## 2025-05-18 - Fix Command Injection in Reconciler

**Vulnerability:** Found a command injection vulnerability in `packages/core/src/reconcile.ts` where `execSync` was used to execute a shell command constructed with a file path directly from the workspace. This means if a path contains shell metacharacters (e.g. `$`, \`, quotes), it could allow arbitrary command execution during the reconcile syntax check step.

**Learning:** When executing a process using Node.js, relying on shell execution functions like `execSync` with strings that contain dynamic or user-controlled input can lead to command injection.

**Prevention:** Use array-based argument passing functions like `spawnSync` along with `process.execPath` (to prevent executing arbitrary executables in `$PATH`) instead of string-based execution functions like `execSync`.
