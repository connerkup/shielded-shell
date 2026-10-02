import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeMerkleRoot,
  computeWorkspaceMerkleRoot,
  createEphemeralOverlay,
  defaultConfig,
  generateAntiSpoofToken,
  generateReceipt,
  InterceptLog,
  MANDATORY_BLOCKED_WRITE_GLOBS,
  PolicyEngine,
  runAcobBenchmark,
  runCommand,
  runCommandSync,
  runSandboxedNodeScriptAsync,
  verifyAntiSpoofToken,
} from "./index.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-v2test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("Tier 2 OpSec: Git Hook & Shell RC Persistence Lockdown", () => {
  it("mandates default write-deny for .git/hooks/**", () => {
    const workspace = makeTempDir();
    const config = defaultConfig();
    const policy = new PolicyEngine(config, workspace);
    const log = new InterceptLog();

    expect(policy.checkWrite(".git/hooks/pre-commit", log)).toBe(false);
    expect(policy.checkWrite(".git/hooks/post-checkout", log)).toBe(false);
    expect(policy.checkWrite(path.join(workspace, ".git", "hooks", "pre-push"), log)).toBe(false);
    expect(policy.checkWrite(".git/hooks/update", log)).toBe(false);

    // Regular project writes should still be allowed
    expect(policy.checkWrite("src/index.ts", log)).toBe(true);
    expect(policy.checkWrite(path.join(workspace, "package.json"), log)).toBe(true);
  });

  it("mandates default write-deny for .bashrc, .zshrc, .profile, and fish config", () => {
    const workspace = makeTempDir();
    const config = defaultConfig();
    const policy = new PolicyEngine(config, workspace);
    const log = new InterceptLog();

    expect(policy.checkWrite(".bashrc", log)).toBe(false);
    expect(policy.checkWrite("~/.bashrc", log)).toBe(false);
    expect(policy.checkWrite(path.join(workspace, ".bashrc"), log)).toBe(false);
    expect(policy.checkWrite(".zshrc", log)).toBe(false);
    expect(policy.checkWrite("~/.zshrc", log)).toBe(false);
    expect(policy.checkWrite(".profile", log)).toBe(false);
    expect(policy.checkWrite(".bash_profile", log)).toBe(false);
    expect(policy.checkWrite(".config/fish/config.fish", log)).toBe(false);
    expect(policy.checkWrite("~/.config/fish/config.fish", log)).toBe(false);
  });

  it("enforces mandatory blocked write globs even with an empty config", () => {
    const workspace = makeTempDir();
    const emptyConfig = defaultConfig();
    emptyConfig.paths.blockedWriteGlobs = [];
    const policy = new PolicyEngine(emptyConfig, workspace);
    const log = new InterceptLog();

    for (const glob of MANDATORY_BLOCKED_WRITE_GLOBS) {
      const probe = glob.replace(/\*\*/g, "foo").replace(/\*/g, "bar");
      expect(policy.checkWrite(probe, log)).toBe(false);
    }
  });

  it("enforces execution timeout cpuTimeoutMs with escalation", async () => {
    const workspace = makeTempDir();
    const result = await runCommand(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000);"],
      {
        cwd: workspace,
        timeoutMs: 250,
        gracePeriodMs: 150,
        stdio: "pipe",
      },
    );

    expect(result.timedOut).toBe(true);
  });

  it("enforces timeout in runSandboxedNodeScriptAsync", async () => {
    const result = await runSandboxedNodeScriptAsync("while (true) {}", {
      timeoutMs: 200,
      gracePeriodMs: 100,
    });

    expect(result.timedOut).toBe(true);
  });
});

describe("Tier 3 Runtime Integrity: Anti-Spoof Assertion Token & Ephemeral Overlay", () => {
  it("generates and verifies anti-spoof assertion tokens", () => {
    const token = generateAntiSpoofToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64);

    expect(verifyAntiSpoofToken(`[PASS] Nonce: ${token}\nDone.`, token)).toBe(true);
    expect(verifyAntiSpoofToken("Tests passed! Exit 0 spoofed.", token)).toBe(false);
    expect(verifyAntiSpoofToken("", token)).toBe(false);
  });

  it("rejects exit code 0 when anti-spoof token is not present in output", async () => {
    const workspace = makeTempDir();
    const result = await runCommand(
      process.execPath,
      ["-e", "console.log('All 50 tests passed'); process.exit(0);"],
      {
        cwd: workspace,
        antiSpoof: true,
        stdio: "pipe",
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.tokenVerified).toBe(false);
  });

  it("accepts exit code 0 when anti-spoof token is present in output", async () => {
    const workspace = makeTempDir();
    const result = await runCommand(
      process.execPath,
      [
        "-e",
        "console.log('Token verified: ' + process.env.SHIELDEDSHELL_ASSERTION_TOKEN); process.exit(0);",
      ],
      {
        cwd: workspace,
        antiSpoof: true,
        stdio: "pipe",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.tokenVerified).toBe(true);
  });

  it("creates ephemeral overlay scratchpad and captures diffs before rollback", () => {
    const workspace = makeTempDir();
    fs.writeFileSync(path.join(workspace, "baseline.txt"), "original", "utf8");

    const overlay = createEphemeralOverlay(workspace);
    expect(fs.existsSync(overlay.tempDir)).toBe(true);
    expect(fs.existsSync(path.join(overlay.tempDir, "baseline.txt"))).toBe(true);

    // Mutate and create files in ephemeral scratchpad
    fs.writeFileSync(path.join(overlay.tempDir, "baseline.txt"), "modified", "utf8");
    fs.writeFileSync(path.join(overlay.tempDir, "injected_hook.sh"), "malicious", "utf8");

    const diffs = overlay.captureDiffs();
    expect(diffs).toContain("baseline.txt");
    expect(diffs).toContain("injected_hook.sh");

    overlay.rollback();
    expect(fs.existsSync(overlay.tempDir)).toBe(false);

    // Original workspace must be 100% unmutated
    expect(fs.readFileSync(path.join(workspace, "baseline.txt"), "utf8")).toBe("original");
    expect(fs.existsSync(path.join(workspace, "injected_hook.sh"))).toBe(false);
  });

  it("runs command in ephemeral mode with automatic zero-disk rollback", async () => {
    const workspace = makeTempDir();
    fs.writeFileSync(path.join(workspace, "code.js"), "const x = 1;", "utf8");

    const result = await runCommand(
      process.execPath,
      [
        "-e",
        "const fs = require('fs'); fs.writeFileSync('code.js', 'const x = 99;'); fs.writeFileSync('temp.txt', 'hello');",
      ],
      {
        cwd: workspace,
        ephemeral: true,
        stdio: "pipe",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.diffs).toBeDefined();
    expect(result.diffs).toContain("code.js");
    expect(result.diffs).toContain("temp.txt");

    // Zero host disk mutation check
    expect(fs.readFileSync(path.join(workspace, "code.js"), "utf8")).toBe("const x = 1;");
    expect(fs.existsSync(path.join(workspace, "temp.txt"))).toBe(false);
  });
});

describe("Tier 4 Multi-Agent Consensus: Verification Receipt Generation", () => {
  it("computes deterministic Merkle roots of workspace diffs", () => {
    const root1 = computeMerkleRoot(["leafA", "leafB"]);
    const root2 = computeMerkleRoot(["leafB", "leafA"]);
    expect(root1).toBe(root2); // Deterministic ordering
    expect(root1.length).toBe(64);

    const emptyRoot = computeMerkleRoot([]);
    expect(emptyRoot.length).toBe(64);
  });

  it("generates a complete VerificationReceipt and terminal card", () => {
    const workspace = makeTempDir();
    fs.writeFileSync(path.join(workspace, "auth_service.js"), "module.exports = {};", "utf8");

    const receipt = generateReceipt({
      workspace,
      success: true,
      iterations: 2,
      reason: "CRITICAL_SUCCESS",
      benchmark: "02_ledger_consensus",
      changedFiles: ["auth_service.js"],
    });

    expect(receipt.version).toBe("2.0");
    expect(receipt.id).toBeDefined();
    expect(receipt.timestamp).toBeDefined();
    expect(receipt.merkleRoot).toHaveLength(64);
    expect(receipt.signature).toHaveLength(64);
    expect(receipt.success).toBe(true);
    expect(receipt.iterations).toBe(2);

    expect(receipt.acob.tier1_osBoundary.status).toBe("PASS");
    expect(receipt.acob.tier2_systemOpSec.status).toBe("PASS");
    expect(receipt.acob.tier3_runtimeIntegrity.status).toBe("PASS");
    expect(receipt.acob.tier4_multiAgentConsensus.status).toBe("PASS");

    expect(receipt.card).toContain("ShieldedShell v2 — Cryptographic Verification Receipt");
    expect(receipt.card).toContain("Receipt ID:");
    expect(receipt.card).toContain("ACOB 4-Tier Verification Matrix:");
    expect(receipt.card).toContain("[PASS] Tier 1:");
    expect(receipt.card).toContain("[PASS] Tier 2:");
    expect(receipt.card).toContain("[PASS] Tier 3:");
    expect(receipt.card).toContain("[PASS] Tier 4:");
  });
});

describe("ACOB Full Benchmark Verification", () => {
  it("passes 100% of all 12 ACOB benchmark checks across 4 tiers", async () => {
    const result = await runAcobBenchmark();
    expect(result.totalChecks).toBe(12);
    expect(result.passedChecks).toBe(12);
    expect(result.allPassed).toBe(true);
    expect(result.scorePercent).toBe(100);
    expect(result.scorecard).toContain("12 / 12 CHECKS PASSED (100%)");
    expect(result.scorecard).toContain("HARDENED HYPERVISOR ACTIVE");
  });
});
