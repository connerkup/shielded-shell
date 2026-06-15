# High-Performance Orchestrator Optimization Blueprint
## Redesigning shell loops and node processes into a compiled Rust Harness

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)

---

### Abstract
The current three-agent loop uses shell scripts (`orchestrator.sh` / `orchestrator.ps1`) and Node.js (`reconcile.js`) to manage control flow, file locking, and verification. While sufficient for a prototype, this introduces a heavy infrastructure constant factor ($C_{\text{infra}}$) dominated by OS process-spawning overhead. 

This document outlines a compiled Rust alternative that replaces subprocess-based orchestration with in-memory execution, zero-trust WASM sandboxing, and strict OS-level thread permissions.

```
+-------------------------------------------------------------------------+
|                       RUST HARNESS ORCHESTRATOR                         |
|                                                                         |
|   +-----------------------+  In-Memory   +--------------------------+   |
|   |   Agent API Clients   | ===========> |   Bicameral Context      |   |
|   | (Anthropic / OpenAI)  | <=========== |   (Decay, Hash State)    |   |
|   +-----------------------+              +--------------------------+   |
|               ||                                     ||                 |
|               || Compile (Sub-ms)                    || Validate        |
|               \/                                     \/                 |
|   +-----------------------+              +--------------------------+   |
|   |   WASM Virtual Mach.  |              |  Type-Safe Rust Solvers  |   |
|   |  (QuickJS / Wasmtime) | ===========> | (Intervals & Datalog)    |   |
|   +-----------------------+              +--------------------------+   |
+-------------------------------------------------------------------------+
```

---

## 1. The Bottlenecks of the Current Harness

| Operations | Current Bottleneck | Time Impact |
| :--- | :--- | :--- |
| **Orchestration Control** | Spawning `bash`/`powershell` loops + `node` processes | ~100ms - 250ms per turn |
| **File Lock / Unlock** | Calling shell tools (`chmod` / `Attrib`) | ~10ms - 50ms per swap |
| **State Sync** | Reading and writing JSON files to disk | ~5ms - 15ms per write |
| **Decrypted Code Execution** | Spawning Node subprocesses for validation | ~50ms - 100ms per run |

For a single multi-agent consensus loop that runs 5 iterations, **over 1.5 seconds is wasted purely on OS-level startup overhead**, independent of LLM inference time.

---

## 2. Optimization A: Zero-Trust WASM Sandboxing (Replacing Node Subprocesses)

Rather than executing the developer's JavaScript in a spawned Node subprocess (which requires complex freezing of prototypes and filesystem modules to prevent escaping), we can execute code inside a sandboxed **WebAssembly Virtual Machine** (e.g., `wasmtime` or `wasmer`) using an embedded JS engine (like **QuickJS** compiled to WASM).

### The Mechanics:
1.  **Instant Startup:** WASM instance startup is sub-millisecond (typically under 100 microseconds), compared to Node's 30–50ms process creation.
2.  **Instruction & Gas Metering:** We can set a strict instruction count limit (gas limit). If the developer's code enters an infinite loop, the WASM VM halts execution instantly. This replaces non-deterministic OS process timeouts.
3.  **Strict Capability Mapping:** The sandbox has *zero* access to the OS filesystem, network, or environment variables unless we explicitly map a virtual memory buffer. Prototype pollution or process exits inside the WASM container cannot affect the host system.

---

## 3. Optimization B: In-Memory State & Context Lifecycle

Currently, the shared context and agent buffers are read from and written to disk. We can move this entire state in-memory inside a unified Rust struct:

```rust
struct AgentLoopState {
    shared_context: String,
    developer_output: Option<String>,
    auditor_output: Option<String>,
    hash_history: HashSet<[u8; 32]>, // SHA-256 state tracking
}
```

*   **No File Locking Required:** Rust's borrow checker and synchronization primitives (`Arc<Mutex<State>>` or `RwLock`) guarantee thread-safety.
*   **Decay and Hashing:** SHA-256 hashes are calculated in-memory in microseconds (using Rust's `sha2` crate) rather than writing temporary files and calling node modules.

---

## 4. Optimization C: Native Direct-to-API Client Handlers

Instead of calling external CLI tools (which spawn subprocesses for each LLM prompt), the Rust harness handles network requests natively using an async client (e.g., `reqwest` + `tokio`).

*   **Concurrency:** We can spawn Agent A and Agent B queries concurrently, evaluating multiple prompt layouts or using divergent paths.
*   **Connection Pooling:** HTTP connections to LLM providers are kept alive, reducing SSL handshake latency by up to 200ms per call.

---

## 5. Architectural Comparison: Current vs. Rust-Optimized

| Metric | Current Prototype (JS/Shell) | Compiled Rust Architecture |
| :--- | :--- | :--- |
| **Startup Cost** | Heavy (OS process creation) | Negligible (In-process execution) |
| **Sandboxing Model** | Prototype Freezing + `spawnSync` | WebAssembly Container (QuickJS / Wasmtime) |
| **Infinite Loop Guard** | OS Process Timeout (coarse-grained) | WASM Gas Metering (fine-grained instruction limit) |
| **I/O Latency** | Disk I/O bound | Memory bound |
| **Binary Portability** | Requires Node + Shell environment | Standalone single-file binary |
