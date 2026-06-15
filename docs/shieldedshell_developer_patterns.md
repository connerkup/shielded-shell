# Developer Integration Patterns: ShieldedShell npm Package
## How to Secure Custom Agentic Loops, Planners, and Tool Execution

**Author:** Systems-Level Decision Architecture Group  
**Workspace Reference:** [my-agent-loop](file:///C:/code/projects/my-agent-loop/)  
**Product Reference:** [shieldedshell.com](https://shieldedshell.com)

---

## 1. Architectural Placement
When building a custom agentic application (like the Peratin voice assistant), the package is integrated directly into the **execution chain** of the planner. Instead of letting the agent output plans and execute them blindly, the harness acts as an inline middleware.

```
       [User Voice/Text Input]
                  │
                  ▼
         [Agent LLM Planner] 
                  │
        (Generates Plan / Code)
                  │
                  ▼
   ┌────────────────────────────────────────────────────────┐
   │             SHIELDEDSHELL MIDDLEWARE GATE              │
   │                                                        │
   │  1. Static Check (O(n) Interval & Datalog Solver)       │
   │     - Are ledger constraints satisfied?                │
   │     - Do API routes violate access rules?              │
   │                                                        │
   │  2. Sandboxed Test Run (In-process V8 isolate)         │
   │     - Does code run without throwing?                  │
   │     - Are filesystem / network reads locked?           │
   └──────────────────────┬─────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼ (Passes)                  ▼ (Violations/Errors)
    [Execute Real Action]       [Auto-Correct Repair Agent]
    - Read CRM database         - Capture error logs
    - Run production code       - Feed back to LLM Planner
                                - Regenerate corrected plan
```

---

## 2. The Three Integration Patterns

### Pattern A: The Static Plan Audit (Pre-Execution Gate)
**Concept:** Verify the logical safety of a generated plan *before* calling any real tools or charging databases.

```typescript
import { analyzeLedgerSafety, DatalogEvaluator } from '@shieldedshell/core';

// Inside Peratin's action planner middleware:
async function auditAgentPlan(plan: any, context: any) {
  // 1. If the plan involves ledger transactions, run the Interval check
  if (plan.type === 'transactions') {
    const audit = analyzeLedgerSafety(context.balances, plan.transfers);
    if (!audit.safe) {
      throw new Error(`Plan rejected: Account "${audit.violatingAccount}" could drop negative.`);
    }
  }

  // 2. If the plan accesses database routes, check Datalog access permissions
  if (plan.type === 'database_query') {
    const dl = new DatalogEvaluator();
    
    // Add routing facts from developer agent
    dl.addFact('query_target', [plan.user_role, plan.target_table]);
    
    // Define safety invariant rule
    dl.addRule(
      { relation: 'denied', args: ['User', 'Table'] },
      [
        { relation: 'query_target', args: ['User', 'Table'] },
        { relation: 'is_sensitive', args: ['Table'] },
        { relation: 'is_not_admin', args: ['User'] }
      ]
    );
    
    dl.solve();
    if (dl.hasFact('denied', [plan.user_role, plan.target_table])) {
      throw new Error(`Access Denied: Role "${plan.user_role}" is not authorized to query table "${plan.target_table}"`);
    }
  }
}
```

---

### Pattern B: The Sandbox Trial Run (Execution Isolation)
**Concept:** When the agent generates a script (e.g. mapping fields from an external HubSpot integration), execute the script inside an isolated V8 container to verify it runs without crashing, while guaranteeing it cannot access the host machine's secrets.

```typescript
import { SecureSandbox } from '@shieldedshell/core';

async function executeAgentScript(scriptCode: string) {
  const sandbox = new SecureSandbox({
    timeoutMs: 3000,
    memoryLimitMb: 128,
    allowNetwork: false, // Prevents exfiltration
    allowFilesystem: false // Protects local configuration
  });

  const result = await sandbox.run(scriptCode);
  
  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr || 'Execution timed out (potential infinite loop)'
    };
  }
  
  return {
    success: true,
    data: result.stdout
  };
}
```

---

### Pattern C: The Auto-Correction Loop (Self-Healing Code)
**Concept:** Instead of failing and terminating the agentic loop on audit errors, feed the structured validation logs directly back to the LLM to rewrite the code automatically.

```typescript
import { analyzeLedgerSafety } from '@shieldedshell/core';

async function orchestrateSafetyLoop(startingBalances: any, transfers: any) {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const audit = analyzeLedgerSafety(startingBalances, transfers);
    
    if (audit.safe) {
      console.log("✅ Code/Plan passed safety check!");
      return executeApprovedTransfers(transfers);
    }

    console.warn("⚠️ Safety Check Failed. Initiating Auto-Correction...");
    
    // Call LLM to repair the plan, feeding it the specific math violation details
    transfers = await callLLMRepairAgent({
      errorMsg: `Safety violation: Account "${audit.violatingAccount}" goes negative to ${audit.violatingBalance} at step ${audit.violatingStep}`,
      failedTransfers: transfers,
      startingBalances: startingBalances
    });

    attempts++;
  }

  throw new Error("Loop terminated: Code failed safety audits after max retries.");
}
```
