# Architectural Specification: AgentShield ShieldedShell (shieldedshell.com)
## Lightweight User-Space Terminal Virtualization for Command-Line Agents

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Domain Registration:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. The Core Concept
When developers run command-line agent loops (e.g., Claude Code, Aider, Cursor CLI, or Cline) directly in their terminal, these agents execute raw bash/PowerShell commands with access to the entire host machine.

**ShieldedShell** (available at [shieldedshell.com](https://shieldedshell.com)) acts as an **intercepting shell wrapper** (a lightweight terminal "virtual machine" running entirely in user-space). It drops the developer into a secure, virtualized terminal session where any agent spawned inside is sandboxed, audited, and controlled.

---

## 2. Developer Experience (The CLI Flow)

```
$ shieldedshell --dir ./my-project

[ShieldedShell Active: Isolated Workspace Bound]
$ claude dev
... (Claude starts and tries to read ~/.ssh/id_rsa or execute 'rm -rf /')
[ShieldedShell Intercept] Blocked read of ~/.ssh/id_rsa (Outside workspace)
[ShieldedShell Intercept] Blocked execution of 'rm -rf /' (Policy restriction)
```

### Main Commands:
*   `shieldedshell`: Spawns a virtual terminal session binding the shell strictly to the target folder.
*   `shieldedshell run <command>`: Wraps a single CLI agent execution (e.g., `shieldedshell run "aider --gpt-4o"`).
*   `shieldedshell orchestrate --dev cursor --audit claude`: Runs the two-agent reconciler consensus loop directly over their command-line utilities.

---

## 3. How ShieldedShell Works (No VM / Docker Overhead)

ShieldedShell virtualizes the environment at three key OS layers in user-space:

```
                  [CLI Agent (Claude Code / Aider)]
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   [PTY Interceptor]    [Copy-on-Write VFS]      [Network Proxy Gate]
   Monitors processes    Writes redirected to    Redirects HTTP/HTTPS
    and shell calls       overlay directory      to prevent credential
    for user approval    until rules pass         exfiltration
```

### A. PTY (Pseudo-Terminal) Interception
*   ShieldedShell spawns a virtual terminal master/slave pair. The CLI agent runs as a child process of ShieldedShell's slave terminal.
*   ShieldedShell inspects all spawned commands (`execve` calls) using system-level tracing (e.g., `ptrace` on Linux, `DTrace` on macOS, or API Hooking via Win32 Job Objects on Windows).
*   High-risk commands (e.g., installing packages, editing system files) are halted, triggering a prompt for user approval.

### B. Copy-on-Write (CoW) Directory Overlay
*   To prevent agents from corrupting the working codebase, ShieldedShell sets up an in-memory or temporary directory overlay.
*   The agent sees the standard project files, but any modification it attempts is written to a temporary overlay folder (`.shieldedshell/overlay/`).
*   **The Reconciler Gate:** The changes in the overlay are only synced and merged to the actual codebase once the static solvers (Interval ledger checks and Datalog policy checks) and compile/syntax tests pass!

### C. Network Proxy Gate
*   Spawns a local loopback proxy.
*   All outbound traffic from the slave terminal session is forced through this proxy.
*   Prevents exfiltration by blocking connections to unverified domains or intercepting secret environment variables (e.g., Slack Webhooks, database strings) in payload parameters.

---

## 4. Built-in Multi-Agent Consensus Orchestration

When running in `orchestrate` mode, ShieldedShell acts as the parent loop orchestrator:
1.  Spawns CLI Agent A (Developer) to generate a code change in the CoW overlay.
2.  Spawns CLI Agent B (Auditor) to review the diff in the overlay.
3.  Executes the static verification check on the overlay.
4.  If approved, merges the overlay to the master project directory. If rejected, sends overlay diffs and compiler warnings back to CLI Agent A.
