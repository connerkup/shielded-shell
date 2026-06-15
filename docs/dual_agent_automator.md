# Architectural Specification: ShieldedShell Dual-Agent Didactic Loop
## Implementing Interactive and Automated Turn-Taking between Developer and Architect Agents

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Concept Overview
Developers are accustomed to using CLI agents (like Claude Code or Aider) interactively. However, letting a single agent write and run code unchecked is risky, and running automated loops in the background can result in corrupted states.

**ShieldedShell** implements a **Dual-Agent Didactic Loop** that combines:
1.  **Interactive Mode:** The user manually prompts and develops alongside their primary agent.
2.  **Auto Mode (Consensus Loop):** The user hands control to ShieldedShell, which automates turn-taking between a **Developer Agent** (with sandboxed write permissions) and an **Architect Agent** (with read-only permissions on codebase, write-isolated to review buffers).

---

## 2. Spatial Write Partitioning (The Permission Model)

To guarantee that the Developer and Architect agents cannot corrupt each other's environments or override safety constraints, ShieldedShell enforces strict directory boundaries:

```
                          [ShieldedShell Sandbox]
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
 [Developer Agent]                                       [Architect Agent]
 * Write access: ./src/ (CoW overlay)                     * Read-only: ./src/
 * Execution: Sandboxed subprocess                       * Write access: ./audit_logs/ only
 * CLI Tools: Allowed to run tests                       * CLI Tools: Disabled (Read-only review)
```

---

## 3. The State Machine & Turn-Taking Loop

```
       +---------------------------------------------+
       |             User Interactive Mode           | <---+
       |    (User chats directly with Developer)     |     |
       +---------------------------------------------+     |
                              │                            |
                   /auto command triggered                 |
                              ▼                            |
       +---------------------------------------------+     |
       |            Step 1: Developer Run            |     |
       |   (Generates code draft in CoW overlay)     |     |
       +---------------------------------------------+     |
                              │                            |
                     Node/Compile check                    |
                              ▼                            |
       +---------------------------------------------+     |
       |            Step 2: Architect Run            |     |
       |  (Reviews diff, writes feedback to ./audit) |     |
       +---------------------------------------------+     |
                              │                            |
                   Evaluate Safety Rules                   |
                    (Interval & Datalog)                   |
                              │                            |
              ┌───────────────┴───────────────┐            |
              ▼ (Audit Fails)                 ▼ (Passed)   |
       +-------------------------------+   +-------------+ |
       |     Feed errors back to       |   | Merge CoW   | |
       |      Developer stdin          |   |  to Master  | |
       +-------------------------------+   +-------------+ |
              │                                    │       |
              └────────────────────────────────────┴───────┘
```

---

## 4. The Developer Experience (CLI Flow)

### Step 1: Initialize the Session
The developer starts a dual-agent session, defining the executables for both the developer and architect roles:
```bash
$ shieldedshell session --dev "claude dev" --architect "claude dev --read-only"
```

### Step 2: Interactive Coding
The developer works normally with the Developer Agent:
```bash
[ShieldedShell Session Active]
$ claude dev
Claude> Let's start building the checkout route. I will draft the file structure.
```

### Step 3: Triggering Auto Mode
The developer wants the agents to implement and self-correct a complex feature without manual intervention. They type the `/auto` slash command into the ShieldedShell interface:
```bash
Claude> I've written the initial checkout function.
$ /auto "Refactor checkout_service.js to ensure no transaction underflows occur, and let the architect verify it"
```

### Step 4: ShieldedShell Automates the Didactic Loop
ShieldedShell intercepts the prompt, takes control of the terminal inputs (PTY master), and automates the loop:

1.  **Developer Phase:** ShieldedShell forwards the prompt to the Developer Agent process. The Developer Agent edits the files in the copy-on-write overlay and runs compile tests.
2.  **Harness Audit:** ShieldedShell runs the linear-time Interval solver. (Suppose Bob's balance could go negative under the new code). The audit fails.
3.  **Architect Phase:** ShieldedShell captures the audit logs, writes them to `./audit_logs/critique.txt`, and spawns the Architect Agent. The Architect reviews the code diff and the critique, and outputs: *"Security issue: line 42 doesn't check bob's balance bounds before deducting amount."*
4.  **Auto-Correction:** ShieldedShell redirects the Architect's feedback directly into the Developer Agent's stdin.
5.  **Iteration 2:** The Developer Agent reads the feedback, edits the file to add the balance bounds check, and saves the file.
6.  **Harness Re-Audit:** The Interval check passes. The Architect Agent reviews the updated diff and outputs: *"AUDIT_PASSED"*.
7.  **Handoff:** ShieldedShell merges the overlay files to the master workspace directory, writes a success summary to the console, and returns terminal control back to the user:
    ```bash
    [ShieldedShell] ✅ Consensus reached after 2 iterations.
    [ShieldedShell] Changes merged to ./src/checkout_service.js.
    [ShieldedShell] Returning to User Interactive Mode.
    $ 
    ```
