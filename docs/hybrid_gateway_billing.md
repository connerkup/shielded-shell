# Architectural Specification: Hybrid Gateway and BYOM Billing Model
## Balancing Open-Source Adoption with Premium Enterprise Monetization

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Executive Concept: The Hybrid Gateway
To maximize adoption, ShieldedShell does not force developers into a single paid platform gateway. Instead, it implements a **Hybrid Gateway Model** that splits into two modes:

1.  **Bring Your Own Model / Keys (BYOM / BYOK) - Free Tier:** Developers configure the CLI to talk directly to their own API keys (Anthropic, OpenRouter, etc.) or local models (Ollama, vLLM). ShieldedShell charges **$0.00**.
2.  **ShieldedShell Cloud Gateway - Metered Convenience Tier:** Developers buy credits on `shieldedshell.com` and use a single metered key. ShieldedShell handles model selection, context caching, and routing.

---

## 2. Local Router Architecture
The ShieldedShell CLI spins up a lightweight, OpenAI-compatible local proxy server at `http://127.0.0.1:8788` during execution. All agents spawned inside the harness are configured to send their API calls to this local port. 

The local proxy intercepts these calls and routes them based on the configuration in `shield.yaml`:

```
               [Agent running inside Harness]
                             │ (Calls local proxy)
                             ▼
               [Local Proxy: http://localhost:8788]
                             │
            ┌────────────────┴────────────────┐
            ▼ (Mode A: BYOK)                  ▼ (Mode B: Cloud Gate)
    [Direct to Provider]              [shieldedshell.com Gateway]
    * Uses developer's keys           * Uses ShieldedShell Token
    * Supports local Ollama           * Applies Context Caching
    * Cost: Paid directly             * Cost: Metered from credits
    * Platform Fee: $0.00             * Platform Fee: Marginal markup
```

---

## 3. YAML Configuration Examples (`shield.yaml`)

### Example A: Bring Your Own Keys (BYOK - Free)
The developer uses their own Anthropic keys. Requests flow directly from their machine to Anthropic:
```yaml
gateway:
  provider: "anthropic"
  api_key_env: "ANTHROPIC_API_KEY" # Reads from local environment
```

### Example B: Bring Your Own Local Model (BYOM - Free & Offline)
The developer runs local models offline using Ollama. Perfect for complete data privacy:
```yaml
gateway:
  provider: "ollama"
  endpoint: "http://127.0.0.1:11434"
  model: "llama3:8b"
```

### Example C: ShieldedShell Cloud Gateway (Metered)
The developer wants zero-setup or central team billing. They use credits purchased on [shieldedshell.com](https://shieldedshell.com):
```yaml
gateway:
  provider: "shieldedshell"
  token_env: "SHIELDEDSHELL_TOKEN"
```

---

## 4. The Value of the Cloud Gateway (Even for Key Holders)

Why would a developer choose the metered Cloud Gateway over their own free keys?

1.  **Zero Configuration:** Instant setup for team members who do not want to manage individual developer accounts on OpenAI or Anthropic.
2.  **Unified Team Billing:** Organizations receive a single consolidated invoice for all agent executions, rather than managing multiple provider accounts.
3.  **Context Caching Savings:** The Cloud Gateway implements active prompt caching. During iterative code refactoring in our dual-agent loop, the system caches the codebase context, reducing duplicate token input costs by up to $60\%$. This makes the Cloud Gateway **cheaper** than using raw keys without caching.
