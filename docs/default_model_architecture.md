# Architectural Specification: Zero-Setup Default Model Strategy
## Delivering Out-of-the-Box Agentic Capabilities without Proprietary API Keys

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Executive Goal: The "Zero-Config" First Run
To minimize friction, a user downloading ShieldedShell must be able to run an automated development loop immediately *without* signing up for OpenAI/Anthropic, putting down a credit card, or setting up API keys. 

We implement a **three-layered default model strategy** that automatically resolves to the best available free, open, or local model runner.

```
                  [User Starts ShieldedShell Session]
                                   │
              ┌────────────────────┴────────────────────┐
              ▼ (Checks Local environment)              │
    [Layer 1: Auto-Detect Local Runners]                │
    * Binds to running Ollama (port 11434)              │
    * Binds to running OpenClaw (port 18789)            │
              │                                         │
              ▼ (If none found, check internet)         │
    [Layer 2: Free Cloud Starter Gateway] ◄─────────────┘
    * Routes to open-weights models (Qwen-Coder / Hermes)
    * 500,000 free tokens out-of-the-box (Zero signup)
              │
              ▼ (If offline and no keys)
    [Layer 3: Embedded Offline Engine]
    * CLI automatically downloads tiny Qwen-Coder GGUF
    * Runs locally on CPU/GPU via embedded llama.cpp wrapper
```

---

## 2. Layer 1: Auto-Detect Local Runners (Free & Private)
The ShieldedShell CLI automatically sweeps standard local ports before launching a session:
*   **Ollama (Port 11434):** If active, VShell queries available models (e.g. `qwen2.5-coder` or `llama3`) and binds them as the default.
*   **OpenClaw (Port 18789):** Natively integrates with OpenClaw gateways (the loopback gateway familiar to Peratin environments), allowing developers to leverage existing custom skills.

---

## 3. Layer 2: Free Cloud Starter Gateway (Hosted Open Weights)
If no local model engines are active, ShieldedShell defaults to our hosted cloud API:
*   **The Models:** We route to state-of-the-art open-weights models hosted on cost-effective providers (e.g. **Qwen-2.5-Coder-32B-Instruct** or **Hermes-3-70B**).
*   **The Incentive:** Every new install gets **500,000 free tokens** pre-allocated to their CLI uuid, requiring no email signup or billing info. This allows developers to experience the "always-on" auto-correct loop instantly.
*   **Cost Management:** Open-source coder models are highly economical (costing a fraction of a cent per 1k tokens), allowing us to subsidize the starter tier at negligible cost.

---

## 4. Layer 3: Embedded Offline Engine (100% Local Fallback)
If the user is offline, has no internet, or explicitly requests `--local-only` without having Ollama installed:
*   **Embedded Wrapper:** The Go CLI includes a lightweight wrapper for **llama.cpp** compiled natively.
*   **Automatic Model Downloader:** On first run, it prompts the user to download a compact, highly optimized coder model (e.g. `Qwen2.5-Coder-1.5B-Instruct` or `DeepSeek-Coder-1.5B` GGUF, ~1.2GB).
*   **Execution:** Runs the model directly on the user's local CPU/GPU inside the CLI process, ensuring 100% private, offline, and free agentic execution.

---

## 5. First-Run Developer Flow

When a user runs `shieldedshell` for the first time without environment keys:
```
$ shieldedshell shell
[ShieldedShell] No API keys (ANTHROPIC_API_KEY, etc.) found.
[ShieldedShell] Auto-selecting default agentic model...
[ShieldedShell] 
  1) Use Free Cloud Gateway (500k tokens of Qwen-2.5-Coder included, requires internet)
  2) Set up Local Offline Engine (Downloads 1.2GB Qwen-Coder-1.5B, runs on your CPU)
  3) Connect to running local provider (Ollama / OpenClaw)
  
Select option (default 1): _
```
This guarantees a smooth, zero-config onboarding path for all developers.
