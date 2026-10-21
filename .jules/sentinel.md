## 2024-05-18 - [Sandbox Environment Leakage]
**Vulnerability:** The sandbox was leaking the host's environment variables (process.env) into the sandboxed child processes.
**Learning:** Node's `child_process.spawn()` and `spawnSync()` default to inheriting `process.env` when the `env` option is `undefined`. This bypasses sandbox isolation if the environment object is not explicitly provided.
**Prevention:** Always explicitly set `env: options.env ?? {}` in child process options when executing untrusted code to enforce a clean environment.
