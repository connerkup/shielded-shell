import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { consolidateSharedContext } from "./context.js";
import { reconcile } from "./reconcile.js";
import { runBenchmarkStaticVerification } from "./static-verify.js";
import { defaultConfig } from "./config.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("consolidateSharedContext", () => {
  it("collapses older failed turns after three failures", () => {
    const dir = makeTempDir();
    const shared = path.join(dir, "shared_context.txt");
    fs.writeFileSync(shared, "Task header\n", "utf8");

    consolidateSharedContext(shared, "failure one");
    consolidateSharedContext(shared, "failure two");
    consolidateSharedContext(shared, "failure three");

    const content = fs.readFileSync(shared, "utf8");
    expect(content).toContain("Consolidated 1 older failed iterations");
    expect(content).toContain("failure two");
    expect(content).toContain("failure three");
    expect(content).not.toContain("failure one");
  });
});

describe("runBenchmarkStaticVerification", () => {
  it("verifies ledger consensus secrets in JS fallback mode", () => {
    const workspace = path.resolve(
      path.join(import.meta.dirname, "..", "..", ".."),
    );
    const result = runBenchmarkStaticVerification(workspace, "02_ledger_consensus");
    expect(result.ok).toBe(true);
  });
});

describe("reconcile", () => {
  it("merges approved developer code and writes CRITICAL_SUCCESS", () => {
    const dir = makeTempDir();
    const mergeTarget = path.join(dir, "auth_service.js");
    const developerOutput = path.join(dir, "developer_output.json");
    const auditorOutput = path.join(dir, "auditor_output.json");
    const sharedContext = path.join(dir, "shared_context.txt");
    const hashHistory = path.join(dir, ".shieldedshell", "state", "hash_history.json");

    fs.writeFileSync(sharedContext, "Task header\n", "utf8");
    fs.writeFileSync(
      developerOutput,
      JSON.stringify({
        code: "function processLedger(balances, transfers) { return { ledger: balances, rejected: [] }; }\nmodule.exports = { processLedger };",
        explanation: "fixture",
      }),
      "utf8",
    );
    fs.writeFileSync(
      auditorOutput,
      JSON.stringify({
        status: "PASSED",
        kill_criteria: [],
        feedback_for_developer: "Looks good",
      }),
      "utf8",
    );

    const result = reconcile({
      workspace: dir,
      paths: {
        developerOutput,
        auditorOutput,
        sharedContext,
        mergeTarget,
        hashHistory,
      },
      config: defaultConfig(),
    });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(sharedContext, "utf8")).toContain("CRITICAL_SUCCESS");
    expect(fs.readFileSync(mergeTarget, "utf8")).toContain("processLedger");
  });

  it("includes kill criteria when audit fails", () => {
    const dir = makeTempDir();
    const mergeTarget = path.join(dir, "auth_service.js");
    const developerOutput = path.join(dir, "developer_output.json");
    const auditorOutput = path.join(dir, "auditor_output.json");
    const sharedContext = path.join(dir, "shared_context.txt");
    const hashHistory = path.join(dir, ".shieldedshell", "state", "hash_history.json");

    fs.writeFileSync(sharedContext, "Task header\n", "utf8");
    fs.writeFileSync(developerOutput, JSON.stringify({ code: "x" }), "utf8");
    fs.writeFileSync(
      auditorOutput,
      JSON.stringify({
        status: "FAILED",
        kill_criteria: ["Missing balance check"],
        feedback_for_developer: "Fix the ledger guard",
      }),
      "utf8",
    );

    const result = reconcile({
      workspace: dir,
      paths: {
        developerOutput,
        auditorOutput,
        sharedContext,
        mergeTarget,
        hashHistory,
      },
      config: defaultConfig(),
    });

    expect(result.success).toBe(false);
    const content = fs.readFileSync(sharedContext, "utf8");
    expect(content).toContain("Kill Criteria:");
    expect(content).toContain("Missing balance check");
  });
});
