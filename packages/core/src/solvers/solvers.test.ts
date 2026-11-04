import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeLedgerSafety, Interval } from "./interval.js";
import { DatalogEvaluator, evaluateApiGatewayPolicy } from "./datalog.js";
import { PolicyEngine } from "../policy.js";
import { defaultConfig } from "../config.js";
import { InterceptLog } from "../intercept.js";
import { parseBracketBlock, runBenchmarkStaticVerification } from "../static-verify.js";

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

  it("rejects NaN, non-finite bounds, and non-2-element arrays", () => {
    expect(() => new Interval(Number.NaN, 10)).toThrow(/Invalid interval bounds/);
    expect(() => new Interval(10, Number.NaN)).toThrow(/Invalid interval bounds/);
    expect(() => new Interval(Number.NaN, Number.NaN)).toThrow(/Invalid interval bounds/);
    expect(() => new Interval(Number.NEGATIVE_INFINITY, 10)).toThrow(/Invalid interval bounds/);
    expect(() => new Interval(0, Number.POSITIVE_INFINITY)).toThrow(/Invalid interval bounds/);
    expect(() => Interval.from(Number.NaN)).toThrow(/Invalid interval bounds/);
    expect(() => Interval.from([Number.NaN, 50])).toThrow(/Invalid interval bounds/);
    expect(() => Interval.from([] as unknown as [number, number])).toThrow(/Invalid interval bounds/);
    expect(() => Interval.from([10] as unknown as [number, number])).toThrow(/Invalid interval bounds/);
    expect(() => Interval.from([10, 20, 30] as unknown as [number, number])).toThrow(
      /Invalid interval bounds/,
    );
  });

  it("rejects negative transfer amounts in analyzeLedgerSafety", () => {
    expect(() =>
      analyzeLedgerSafety(
        { Alice: [500, 500], Bob: [50, 50] },
        [{ from: "Alice", to: "Bob", amount: -100 }],
      ),
    ).toThrow(/Invalid transfer amount/);

    expect(() =>
      analyzeLedgerSafety(
        { Alice: [500, 500], Bob: [50, 50] },
        [{ from: "Alice", to: "Bob", amount: [-10, 50] }],
      ),
    ).toThrow(/Invalid transfer amount/);
  });

  it("parses nested interval brackets without truncating at inner closing bracket", () => {
    const text = `Pending Transfers (JSON):\n[\n  {"from": "Alice", "to": "Bob", "amount": [40, 60]},\n  {"from": "Bob", "to": "Charlie", "amount": [10, 20]}\n]\nStatus: pending`;
    const extracted = parseBracketBlock(text);
    expect(extracted).not.toBeNull();
    const parsed = JSON.parse(extracted!);
    expect(parsed).toEqual([
      { from: "Alice", to: "Bob", amount: [40, 60] },
      { from: "Bob", to: "Charlie", amount: [10, 20] },
    ]);
    expect(parseBracketBlock("no brackets here")).toBeNull();
    expect(parseBracketBlock("unbalanced [1, [2, 3]")).toBeNull();

    const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-nested-"));
    try {
      const benchDir = path.join(tempWorkspace, "benchmark", "02_ledger_consensus");
      fs.mkdirSync(benchDir, { recursive: true });
      fs.writeFileSync(
        path.join(benchDir, "auditor_secret.txt"),
        'Starting Balances:\n{\n  "Alice": [50, 50],\n  "Bob": [0, 0]\n}\n',
        "utf8",
      );
      fs.writeFileSync(
        path.join(benchDir, "developer_secret.txt"),
        'Pending Transfers:\n[\n  {"from": "Alice", "to": "Bob", "amount": [40, 60]}\n]\n',
        "utf8",
      );

      const unsafeVerify = runBenchmarkStaticVerification(tempWorkspace, "02_ledger_consensus");
      expect(unsafeVerify.ok).toBe(false);
      expect(unsafeVerify.error).toContain("Alice");

      fs.writeFileSync(
        path.join(benchDir, "auditor_secret.txt"),
        'Starting Balances:\n{\n  "Alice": [100, 100],\n  "Bob": [0, 0]\n}\n',
        "utf8",
      );
      const safeVerify = runBenchmarkStaticVerification(tempWorkspace, "02_ledger_consensus");
      expect(safeVerify.ok).toBe(true);
    } finally {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
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

  it("agent env mode keeps network and API keys available", () => {
    const policy = new PolicyEngine(defaultConfig(), process.cwd());
    const env = policy.buildSandboxEnv(
      {
        OPENAI_API_KEY: "test-key",
        HTTP_PROXY: "http://corp-proxy:8080",
      },
      "agent",
    );
    expect(env.HTTP_PROXY).toBe("http://corp-proxy:8080");
    expect(env.OPENAI_API_KEY).toBe("test-key");
    expect(env.SHIELDEDSHELL).toBe("1");
  });

  it("sandbox env mode blocks network via loopback proxy", () => {
    const policy = new PolicyEngine(defaultConfig(), process.cwd());
    const env = policy.buildSandboxEnv({ OPENAI_API_KEY: "test-key" }, "sandbox");
    expect(env.HTTP_PROXY).toBe("http://127.0.0.1:9");
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});
