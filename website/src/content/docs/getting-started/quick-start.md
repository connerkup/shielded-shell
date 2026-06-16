---
title: Quick start
description: Run your first sandboxed command with ShieldedShell.
---

## 1. Install and init

```bash
npm install -g @shieldedshell/cli@beta
cd your-project
shieldedshell init
```

## 2. Doctor check

```bash
shieldedshell doctor
```

Confirms Node version, config path, and which agent engines are on PATH.

## 3. Run a sandboxed command

```bash
shieldedshell run node -e "console.log('hello from sandbox')"
```

Typical output:

```text
[ShieldedShell] Allowed INFO: Active workspace: /path/to/your-project
[ShieldedShell] Blocked READ: /Users/you/.ssh/ (outside workspace)
[ShieldedShell] Allowed EXEC: node -e console.log('hello from sandbox')
[ShieldedShell] Allowed AUDIT: Launching sandboxed process
hello from sandbox
```

Reads outside the workspace and common secret paths are blocked. Network is off unless you change policy.

## 4. Interactive shell (optional)

```bash
shieldedshell shell
```

Opens a shell bound to the workspace and copy-on-write overlay.

## 5. Static safety checks (optional)

Ledger interval check:

```bash
shieldedshell verify --type ledger \
  --balances '{"Alice":[500,500],"Bob":[50,50]}' \
  --transfers '[{"from":"Alice","to":"Bob","amount":600}]'
```

Routing / Datalog check:

```bash
shieldedshell verify --type routing \
  --policies '{"/api/v1/billing":"Public"}' \
  --routes '{"/api/v1/billing":"http://billing"}'
```

## What's next

- [Sandbox and policy](/guides/sandbox/) — how containment works
- [Dual-agent loop](/guides/dual-agent-loop/) — multi-agent consensus with reconciler gates
