# Architectural Specification: Hybrid CLI + Local Web Dashboard
## Balancing Terminal Velocity with Rich Visual Invariant Monitoring

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Executive Concept: The Hybrid UI
Developers prefer working inside the terminal for speed and hotkey integration. However, visualizing complex relational data (like Datalog policy trees, transaction balance bounds, or time-travel git branches) inside a standard CLI is highly constrained.

**ShieldedShell** implements a **Hybrid CLI + Local Web Dashboard** architecture:
*   **The Terminal CLI:** The primary interface for launching sessions, running command-line agents, and viewing real-time intercept logs.
*   **The Local Web Dashboard:** An opt-in, browser-based user interface served locally (e.g. at `http://localhost:8789`) that provides rich, interactive visualization panels.

---

## 2. Component Split & User Interfaces

```
                [User Shell (CLI Commands)]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Terminal CLI Interface]          [Local Web Dashboard (GUI)]
   * Spawns agent processes          * Serve path: http://localhost:8789
   * Prints real-time log stream     * Time-Travel Branching Visualizer
   * Accepts hotkey interrupts       * Datalog Route Sensitivity Graph
   * Standard coding input           * Interval Ledger Balance Timeline
                                     * Token Burn & Budget Metering
```

---

## 3. The Local Web Dashboard Features

When the user runs `shieldedshell --gui` (or opens the port link printed in the terminal), the browser launches a lightweight, responsive dashboard with four main views:

### A. The Time-Travel Git Tree
*   Displays a horizontal node tree of agent iterations.
*   **Interactive Branching:** The user can click on any past iteration node, view the code diff generated at that turn, write a new guiding prompt, and spin up a new development branch from that node visually.

### B. The Ledger Interval Timeline
*   Instead of reading CLI balance logs, the dashboard renders a bar chart showing the minimum and maximum possible balances of each account over the transfer sequence.
*   The exact transaction step that violates the safety rules is highlighted in red, showing the underflow risk.

### C. The Datalog Policy Graph
*   An interactive relational graph showing database tables, API routes, and policy nodes.
*   Draws visual paths connecting sensitive data routes to public endpoints, showing exactly where a rule implication created a security violation.

### D. Token Burn & Budget Monitor
*   Real-time progress bars showing the USD cost consumed by each agent in the swarm.
*   Tracks cache hit rates to show how much money the ShieldedShell Cloud Gateway is saving them.

---

## 4. Technology Stack (Tauri-Ready)

To keep the binary size tiny and avoid resource-heavy frameworks, the frontend is built to compile into a single static bundle embedded in the Go binary:

1.  **Backend (Local Server):** Built in **Go**, starting a lightweight HTTP server (`net/http`) and WebSocket connection for real-time terminal log streaming.
2.  **Frontend Dashboard:** Built using **React + Vite + Tailwind CSS**, compiled to static HTML/JS/CSS assets.
3.  **Asset Embedding:** Go's `embed` package compiles the frontend assets directly into the Go binary. The user downloads a single file; no separate web servers or folders are created.
4.  **Desktop App Packaging (Optional):** The exact same static bundle is packaged into a **Tauri** desktop application (`shieldedshell-desktop`), which uses the OS's native Webview, keeping the app size under **12MB** (compared to 150MB+ Electron apps).
