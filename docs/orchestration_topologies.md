# Architectural Specification: Orchestration Topologies (Swarm Templates)
## Defining Modular, Multi-Agent Structures and Security Profiles in ShieldedShell

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. The Concept of Topologies
Rather than hardcoding a single Developer-Architect loop, ShieldedShell allows developers to configure **Orchestration Topologies** via YAML templates. 

Since ShieldedShell provides a **trustless sandbox**, users can spin up highly complex, multi-agent swarms (e.g. including Product Managers, QA, and CEOs) safely. The harness automatically isolates the write permissions, budget limits, and file visibility of each agent in the swarm.

---

## 2. The Three Pre-Configured Templates

```
                  [User High-Level Goal]
                            │
                            ▼
           +----------------------------------+
           |     CEO (Executive Director)     |  <-- Holds product vision, manages budget
           +----------------------------------+
                            │
                            ▼
           +----------------------------------+
           |       Architect (Designer)       |  <-- Creates schemas & reviews code
           +----------------------------------+
                            │
                            ▼
           +----------------------------------+
           |       Developer (Coder)          |  <-- Writes implementation (CoW Jail)
           +----------------------------------+
```

### Template A: "The Duo" (Pair Programming)
*   **Agents:** Developer + Auditor.
*   **Goal:** Rapid feature refinement, bug fixing, or single-file additions.
*   **Sandbox Profile:** Developer has write access to `./src`. Auditor is read-only, writing feedback to `/audit_logs/`.

### Template B: "The Squad" (Feature Team)
*   **Agents:** Product Manager (PM) + Developer + QA Auditor.
*   **Goal:** Implementing multi-file features or database migrations from user stories.
*   **Workflow:** 
    1.  PM breaks the user goal into a checklist of tasks.
    2.  Developer implements the tasks one by one.
    3.  QA Auditor runs the compile checks and validation tests on the overlay before merging.

### Template C: "The Enterprise Swarm" (Full App Builder)
*   **Agents:** CEO (Executive) + Architect + Developer + QA Auditor.
*   **Goal:** Building a complete application from scratch.
*   **Workflow:**
    1.  **CEO:** Receives high-level vision (e.g., "Build a SaaS billing dashboard"), defines the roadmap, manages the budget/credit limits, and approves the overall product milestones.
    2.  **Architect:** Designs the database schema and defines API contracts.
    3.  **Developer:** Implements the routes, files, and frontend pages in the sandbox overlay.
    4.  **QA Auditor:** Verifies compile safety and checks static ledger/routing invariants.

---

## 3. Configuration Schema (`shield.yaml`)

Developers define their swarm topologies using a declarative YAML structure:

```yaml
# shield.yaml - Enterprise Swarm Topology Example
version: "1.0"
topology: "EnterpriseSwarm"

# Financial Guardrails
budget:
  max_credit_burn_usd: 15.00
  halt_on_budget_exhaustion: true

agents:
  CEO:
    role: "Product Direction & Roadmap Handoff"
    model: "claude-3-5-opus"
    # The CEO cannot edit codebase; can only update roadmap and budget
    write_permissions:
      - "./roadmap.md"
      - "./status.json"
    read_permissions:
      - "./src/"
      - "./design/"

  Architect:
    role: "Technical Design & API Contract Reviewer"
    model: "claude-3-5-sonnet"
    write_permissions:
      - "./design/"
    read_permissions:
      - "./src/"

  Developer:
    role: "Code Implementation"
    model: "claude-3-5-sonnet"
    # Developer can write code files inside the Copy-on-Write sandbox
    write_permissions:
      - "./src/"
    read_permissions:
      - "./src/"
      - "./design/"

  QA_Auditor:
    role: "Security & Compile Invariant Verification"
    model: "claude-3-5-sonnet"
    # QA cannot write code; can only write test summaries and feedback
    write_permissions:
      - "./tests/results/"
    read_permissions:
      - "./src/"
```
