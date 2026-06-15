# Productization Specification: AgentShield
## A Zero-Configuration Local Safety Harness for AI Agent Execution

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)

---

## 1. Product Vision
When friends, family, or developers download and run open-source AI agents (e.g. AutoGPT, OpenInterpreter, or custom scripts), they grant these agents access to their local shell, files, and credentials. A single hallucination or malicious payload can result in wiped directories, leaked personal data, or stolen API keys.

**AgentShield** is a lightweight, zero-dependency command-line safety harness. It intercepts agent actions, verifies logical invariants, and sandbox-executes code drafts, protecting the host system from runaway agent behaviors.

---

## 2. Core Value Proposition

```
  [User Shell / Agent Run]
            │
            ▼
    [AgentShield CLI] ────── (Reads config: shield.yaml)
            │
    ┌───────┴────────────────────────────────┐
    ▼                                        ▼
[Static verification]              [Secure Execution Sandbox]
* O(Nc) Interval Invariants        * Directory Binding (Chroot-like)
* O(N^k) Datalog Permissions       * Resource Quotas (CPU/Memory)
* Strict Type-Safety               * Instruction-limited JS VM (Goja)
            │                                │
            └───────────────┬────────────────┘
                            ▼
                     [Host Safe Gate]
```

1.  **Zero-Dependency Install:** Packaged as a single compiled executable (`agentshield` / `agentshield.exe`). Users do not need Node, Python, Docker, or compilers installed.
2.  **Sandbox Jail (Directory Binding):** Constrains the agent's filesystem visibility to a single target folder (e.g., `./sandbox`). Any read/write outside this path is blocked at the system call level.
3.  **Auto-Healing Reconciler Loop:** Intercepts compiler errors or invariant warnings, automatically feeds them back to the LLM agent, and loops until the code passes the safety gate.
4.  **Resource Limits:** Imposes strict memory caps, network access rules, and execution timeouts.

---

## 3. Product Architecture

To achieve zero dependencies and sub-millisecond execution overhead, the product is structured using **Go (Golang)**:

### Component Layout:
*   **Orchestrator Core (Go):** Manages the state machine, parses `shield.yaml`, handles file synchronization, and logs histories.
*   **Embedded JS VM (Goja):** An in-process, pure-Go ECMAScript engine. Executing JS validators runs entirely in user-space inside Go, with zero OS subprocess latency and no access to filesystem or network APIs.
*   **System Sandboxing (OS-Specific):**
    *   **Windows:** Uses Job Objects to limit CPU, memory, and enforce process trees.
    *   **macOS/Linux:** Restricts processes via `chroot` / namespaces or syscall filters (`seccomp`).

---

## 4. User Configuration (`shield.yaml`)

Users configure their security policy using a simple, human-readable YAML file placed in their project root:

```yaml
# AgentShield Security Policy
version: "1.0"

sandbox:
  workspace_dir: "./workspace"     # Strict folder containment
  allow_network: false             # Block network calls inside sandbox
  max_memory_mb: 256
  cpu_timeout_ms: 3000

invariants:
  # Numerical ledger tracking
  ledger:
    enabled: true
    min_balance: 0.0

  # Logic permissions routing
  routing:
    enabled: true
    allow_sensitive_public: false

auto_heal:
  max_retry_cycles: 5
  model: "claude-3-5-sonnet"       # Model used for code repair
```

---

## 5. Execution Lifecycle

1.  **Launch:** The user runs their agent through the safety harness:
    `agentshield run --agent "python my_agent.py" --config shield.yaml`
2.  **Intercept & Inspect:** When the agent generates a script or transaction draft, AgentShield halts execution.
3.  **Static Evaluation:**
    *   Runs the linear-time Interval solver to ensure ledger flows cannot violate `min_balance`.
    *   Runs the Datalog evaluator to verify route security permissions.
4.  **Sandbox Trial:** Compiles and runs the script inside the embedded JS VM with memory and network blocked.
5.  **Reconciliation:**
    *   *If success:* Merges the output to the target files and exits.
    *   *If failure:* Bundles compiler stderr and invariant logs, calls the auto-heal repair agent, and loops.
