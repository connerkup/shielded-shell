# Architecture Blueprint: Plumbing Estimate for Robust Multi-Agent Loop
## Minimum Viable Infrastructure for Asymmetric Safety & Unsupervised Poison Detection

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)

---

### Executive Summary
Building a moderately robust safety harness for autonomous agent loops does not require heavy enterprise orchestration platforms. By leveraging Node.js core modules, standard child process spawning, basic shell permissions, and light LLM profiling, we can construct the entire pipeline in under **1,000 lines of custom, dependency-light code**. 

Below is the breakdown of the exact architectural components ("plumbing") required, estimated implementation complexity, and external dependencies.

---

## 1. The Core Safety Sandbox (Tier 1: High Priority)
These components prevent direct system takeover, process hijacking, and environment tampering. They represent the "not-subtle" security boundaries.

### 1.1 Spatial Partitioning Harness (PowerShell/Bash)
*   **Role:** Dynamically restricts write permissions of files before spawning agent processes, ensuring neither agent can modify the other's buffers or edit target files directly.
*   **Plumbing:** Simple `attrib` (Windows) or `chmod` (Unix) toggles inside a script.
*   **Lines of Code:** ~50 lines.
*   **Dependencies:** Native OS shell utilities.

### 1.2 Isolated Subprocess & Secure Token Verification (Node.js)
*   **Role:** Spawns validation tests in child processes, generates cryptographically secure random tokens, feeds them via `stdin` to a private lexical closure, and checks for early exits or crashed states.
*   **Plumbing:** `child_process.spawnSync` wrapper inside the reconciler.
*   **Lines of Code:** ~80 lines.
*   **Dependencies:** Node.js native `child_process` and `crypto` modules.

### 1.3 Active Environment Freeze (Node.js)
*   **Role:** Protects the validation test runner from prototype pollution, module hijacking, or stream interception by locking global state *before* importing untrusted code.
*   **Plumbing:** Calls `Object.freeze()` on built-in prototypes and objects.
*   **Lines of Code:** ~15 lines.
*   **Dependencies:** None (Native JS).

### 1.4 Execution Timeout Gate (Node.js)
*   **Role:** Terminates validation runs that enter infinite loops or exceed safe processing times.
*   **Plumbing:** Sets the `timeout` parameter in `spawnSync` and catches `'ETIMEDOUT'` error codes.
*   **Lines of Code:** ~15 lines.
*   **Dependencies:** None.

---

## 2. Unsupervised Poison & Impasse Detection (Tier 2: Advanced Safety)
These components detect logical inconsistencies, specification gaming, and coordinate drift without hardcoded secret keys.

### 2.1 Divergent Generator & Entropy Engine (Node.js)
*   **Role:** Spawns 2 or 3 independent agent calls (e.g. Sonnet & GPT-4o) with the same prompt, runs their outputs through the sandbox, and compares their resulting state JSON files.
*   **Plumbing:** Parallel API invocations and a deep JSON comparison engine.
*   **Lines of Code:** ~120 lines.
*   **Dependencies:** Any standard LLM client SDK.

### 2.2 Symbolic Constraint SAT Parser (Node.js/Python)
*   **Role:** Extracts logical assertions from prompts and code specifications, compiles them into constraints, and runs a SAT solver to verify satisfiability.
*   **Plumbing:** An LLM agent sweeps the prompt to produce JSON constraints, which are evaluated using a Z3 solver wrapper.
*   **Lines of Code:** ~150 lines.
*   **Dependencies:** `@z3-solver/api-node` (or Z3 Python bindings).

### 2.3 Dynamic Invariant Fuzzer (Node.js)
*   **Role:** Automatically generates fuzzed inputs and verifies universal system assertions (e.g. conservation of account values).
*   **Plumbing:** A test harness that takes developer exported functions, generates 100 randomized inputs, and asserts invariants.
*   **Lines of Code:** ~100 lines.
*   **Dependencies:** None (Simple math fuzz generators).

### 2.4 Debate Convergence Monitor (Node.js)
*   **Role:** Evaluates the discussion loop between the Developer and Auditor. Detects oscillation (impasses) vs. convergence.
*   **Plumbing:** Keeps a log of the last 3 JSON outputs. Counts critiques vs. fixes and measures semantic drift (or counts iterations).
*   **Lines of Code:** ~80 lines.
*   **Dependencies:** None.

---

## 3. Grounding & Factual Verification (Tier 3: Factual Safety)
These components prevent agents from writing logically sound code based on false premises.

### 3.1 Active Grounding Sweeper (Node.js)
*   **Role:** Extract facts asserted by the agent (e.g., node package versions, Stripe API properties) and checks them against the live environment or docs.
*   **Plumbing:** Parses `developer_output.json` for assertions, runs shell sweeps (e.g. `npm info package_name`), or executes Google Search API queries.
*   **Lines of Code:** ~150 lines.
*   **Dependencies:** Google Search API / custom scraping utilities.

### 3.2 Sandbox Shadow Runner (Node.js)
*   **Role:** Runs the code in a sandbox connected to simulated or staging external services (e.g. mock server) to capture runtime response and payload errors.
*   **Plumbing:** Spin up mock server mockups or pipe network logs from standard HTTP clients.
*   **Lines of Code:** ~120 lines.
*   **Dependencies:** `nock` or a simple Express-based mock endpoint runner.

---

## 4. Total Cost and Code Allocation Summary

| Component | Code Complexity | Target Lines | Implementation Priority |
| :--- | :--- | :--- | :--- |
| **Spatial Permission Toggles** | Very Low | ~50 LOC | Critical (Day 1) |
| **Subprocess + Stdin Token** | Medium | ~80 LOC | Critical (Day 1) |
| **Active Object Freezes** | Low | ~15 LOC | Critical (Day 1) |
| **Execution Timeout Gate** | Low | ~15 LOC | Critical (Day 1) |
| **Divergent Entropy Engine** | Medium | ~120 LOC | High (Day 2) |
| **SAT Solver Constraint Gate** | High | ~150 LOC | Medium (Day 3) |
| **Dynamic Invariant Fuzzing** | Medium | ~100 LOC | High (Day 2) |
| **Debate Convergence Monitor** | Low-Medium | ~80 LOC | High (Day 2) |
| **Active Grounding Sweeper** | Medium | ~150 LOC | Medium (Day 3) |
| **Sandbox Shadow Runner** | Medium | ~120 LOC | Medium (Day 3) |
| **Total Plumbing Code** | | **~880 LOC** | |

### Recommendations for Phased Rollout
1.  **Phase 1 (Security Baseline):** Implement the Spatial Locks, Subprocess Runner, Stdin Token, Timeout Gate, and Prototype Freezes. This requires **under 200 lines of code** and immediately neutralizes all same-process execution exploits.
2.  **Phase 2 (Alignment Baseline):** Add the Divergent Entropy Engine and the Dynamic Invariant Fuzzing. This requires **~220 lines of code** and catches the majority of specification gaming and loop oscillations.
3.  **Phase 3 (Factual & Logic Verification):** Integrate SMT solvers (Z3) and Active Grounding. This completes the zero-knowledge unsupervised poison detection system.
