# Inbox: MCP Browser (archived stub)

**Source:** `projects/work/mcp-browser` (Idea Bank AI #8)  
**Archived because:** Playwright MCP covers agent browser control; ShieldedShell owns safe execution.

## Stub intent

MCP server exposing Puppeteer **headed** browser to IDE agents:

| Tool | Purpose |
|------|---------|
| `navigate` | Load URL |
| `screenshot` | Visual verify after codegen |
| `click` / `fill` | Simulate user flows |
| Session | Single long-lived browser per agent run |

## Relationship to ShieldedShell

| Layer | Owner |
|-------|--------|
| Browser automation | Playwright MCP (Cursor / external) |
| Policy, sandbox, loop | `@shieldedshell/cli` |
| Audit trail | ShieldedShell reconcile + overlay |

## What ShieldedShell could adopt

1. **Engine profile** — document Playwright MCP as optional `verify` backend alongside existing engines ([engine-profiles](https://github.com/connerkup/shielded-shell) / local `website/src/content/docs/reference/engine-profiles.md`).
2. **Session log schema** — stub planned Mongo for session logs; align with ShieldedShell run artifacts instead of new DB.
3. **Do not ship** `@shieldedshell/mcp-browser` unless Playwright MCP gaps are documented (e.g. CI-only headed requirement).

## Stub first slice

```
Agent calls MCP tool → dispatch Puppeteer → return screenshot or DOM snapshot
```

Equivalent verification path today: Playwright MCP in agent session + `shieldedshell verify` where applicable.

## References

- Stub: `projects/work/mcp-browser/ARCHIVED.md`
- Idea bank: `reference/idea-bank/categories/ai-data-intelligent-systems.md` §8
