# Product Strategy: ShieldedShell First Product Surface (MVP)
## Positioning the CLI Safety Harness vs. the npm Library Developer API

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Executive Summary & Recommendation
To productize [shieldedshell.com](https://shieldedshell.com) successfully, **the first product surface (MVP) must be the Developer-Focused CLI Terminal Harness (ShieldedShell CLI)**, rather than the npm library. 

While the npm package is a valuable secondary API for developers building custom platforms (like Peratin), the CLI harness targets a much larger immediate market (every developer using Claude Code, Cursor, Aider, or VSCode CLI agents) with significantly lower adoption friction and an instant "Aha!" moment.

---

## 2. Strategic Evaluation: CLI Harness vs. npm Library

| Dimension | Option A: npm Library API | Option B: ShieldedShell CLI Harness (MVP) |
| :--- | :--- | :--- |
| **Primary Target** | Developers building custom agentic platforms. | Developers *using* AI agent CLI tools daily. |
| **Adoption Friction** | **High** (Requires changing codebases, custom planning pipelines, and deployment logic). | **Zero** (Download the binary and run it before any agent command). |
| **Time-to-Value** | Slow (Requires custom integration and test setup). | **Instant** (Visual feedback of blocked network calls and file writes). |
| **Market Size** | Small (Niche category of agent engineers). | **Massive** (Millions of developers adopting LLM code editors). |
| **Virality Engine** | Developer-to-developer API documentation. | "Watch how I safely ran Claude Code on my local directory with one command". |

---

## 3. The MVP Feature Set: ShieldedShell CLI

The ShieldedShell MVP should focus on securing and coordinating **local terminal sessions**:

1.  **Zero-Config Containment:** 
    *   Developers download `shieldedshell` (compiled Go binary) and run their agents:
        `shieldedshell run "claude dev"`
    *   It instantly locks the agent's filesystem writes to the current project folder.
2.  **Visual Intercept Log:**
    *   A clean terminal GUI showing real-time audits:
        `[ShieldedShell] Intercepted Read: ~/.aws/credentials (BLOCKED)`
        `[ShieldedShell] Static Audit: Consensus validated in 1.2ms (SAFE)`
3.  **Built-in Multi-Agent Orchestrator:**
    *   Out-of-the-box "pair programming" consensus loop. Developers can configure Cursor to write code and Claude Code to audit it automatically in their local workspace.
4.  **Local Policy Config (`shield.yaml`):**
    *   A simple YAML file in their project root specifying which network domains or folders are whitelisted.

---

## 4. The Expansion Roadmap

```
  [Phase 1: CLI Harness (MVP)]
  - Launch on GitHub/ProductHunt: "Secure your Claude/Cursor CLI agents locally."
  - Acquire developer users with zero adoption friction.
            │
            ▼
  [Phase 2: Platform Validation]
  - Developers love the safety of ShieldedShell locally.
  - They ask: "How do I embed these same safety rules into my production server?"
            │
            ▼
  [Phase 3: The npm/API Library]
  - Release `@shieldedshell/core` npm library.
  - Developers use the same Interval/Datalog solvers inside their SaaS platforms.
```
