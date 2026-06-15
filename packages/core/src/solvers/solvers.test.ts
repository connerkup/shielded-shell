import { describe, expect, it } from "vitest";
import { analyzeLedgerSafety, Interval } from "./interval.js";
import { DatalogEvaluator, evaluateApiGatewayPolicy } from "./datalog.js";
import { PolicyEngine } from "../policy.js";
import { defaultConfig } from "../config.js";
import { InterceptLog } from "../intercept.js";
import path from "node:path";

describe("Interval ledger solver", () => {
  it("accepts safe transfers", () => {
    const result = analyzeLedgerSafety(
      { Alice: [500, 500], Bob: [50, 50] },
      [{ from: "Alice", to: "Bob", amount: 100 }],
    );
    expect(result.safe).toBe(true);
  });

  it("rejects possibly unsafe transfers", () => {
    const result = analyzeLedgerSafety(
      { Alice: [50, 50], Bob: [0, 0] },
      [{ from: "Alice", to: "Bob", amount: [40, 60] }],
    );
    expect(result.safe).toBe(false);
    expect(result.violatingAccount).toBe("Alice");
  });

  it("supports scalar interval helpers", () => {
    const i = Interval.from(10);
    expect(i.min).toBe(10);
    expect(i.max).toBe(10);
  });
});

describe("Datalog routing solver", () => {
  it("flags sensitive public routes", () => {
    const result = evaluateApiGatewayPolicy(
      { "/api/v1/billing": "Public", "/api/v1/auth": "Public" },
      { "/api/v1/billing": "http://billing", "/api/v1/auth": "http://auth" },
    );
    expect(result.safe).toBe(false);
    expect(result.violations).toContain("/api/v1/billing");
  });

  it("derives facts via horn rules", () => {
    const dl = new DatalogEvaluator();
    dl.addFact("parent", ["a", "b"]);
    dl.addRule(
      { relation: "ancestor", args: ["X", "Y"] },
      [{ relation: "parent", args: ["X", "Y"] }],
    );
    dl.solve();
    expect(dl.hasFact("ancestor", ["a", "b"])).toBe(true);
  });
});

describe("PolicyEngine", () => {
  it("blocks reads outside workspace", () => {
    const workspace = path.resolve(".");
    const policy = new PolicyEngine(defaultConfig(), workspace);
    const log = new InterceptLog();
    const events: string[] = [];
    const originalError = console.error;
    console.error = (msg: string) => events.push(msg);
    try {
      expect(policy.checkRead(path.join(process.env.USERPROFILE ?? "/", ".ssh", "id_rsa"), log)).toBe(
        false,
      );
    } finally {
      console.error = originalError;
    }
    expect(events.some((e) => e.includes("Blocked"))).toBe(true);
  });

  it("blocks high-risk shell patterns", () => {
    const policy = new PolicyEngine(defaultConfig(), process.cwd());
    const log = new InterceptLog();
    expect(policy.scanCommand("rm -rf /", log)).toBe(false);
  });
});
