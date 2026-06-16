import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultConfig } from "./config.js";
import { buildEngineCommand, buildLoopCommands, parseAgentEngine, resolvePromptPaths } from "./engines.js";
import { orchestrateDualAgentLoop } from "./orchestrator.js";
import { reconcile } from "./reconcile.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-loop-"));
  tempDirs.push(dir);
  return dir;
}

function copyRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function repoRoot(): string {
  return path.resolve(import.meta.dirname, "..", "..", "..");
}

function fixturePath(name: string): string {
  return path.join(import.meta.dirname, "..", "fixtures", name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("engines", () => {
  it("resolves default prompts from repo", () => {
    const prompts = resolvePromptPaths(repoRoot());
    expect(fs.existsSync(prompts.developer)).toBe(true);
    expect(fs.existsSync(prompts.auditor)).toBe(true);
  });

  it("builds loop commands for cursor engine", () => {
    const workspace = repoRoot();
    const { devCommand, auditCommand, prompts } = buildLoopCommands(workspace, "cursor");
    expect(devCommand).toContain("cursor-agent.cmd");
    expect(auditCommand).toContain("cursor-agent.cmd");
    expect(prompts.developer).toContain("agent_a_prompt.txt");
  });

  it("builds claude loop commands with tool hint and acceptEdits", () => {
    const workspace = repoRoot();
    const { devCommand, auditCommand } = buildLoopCommands(workspace, "claude");
    expect(devCommand).toContain("claude --bare");
    expect(devCommand).toContain("--permission-mode acceptEdits");
    expect(devCommand).toContain("Write or Edit tool");
    expect(auditCommand).toContain("--allowedTools");
  });

  it("builds cline loop commands with cwd, auto-approve, and file hint", () => {
    const workspace = repoRoot();
    const { devCommand, auditCommand } = buildLoopCommands(workspace, "cline");
    expect(devCommand).toContain("cline ");
    expect(devCommand).toContain("-c ");
    expect(devCommand).toContain(workspace);
    expect(devCommand).toContain("--auto-approve true");
    expect(devCommand).toContain("-t 900");
    expect(devCommand).toContain("file write/edit tools");
    expect(auditCommand).not.toContain("--prompt");
  });

  it("builds aider loop commands with phase-specific file targets", () => {
    const workspace = repoRoot();
    const { devCommand, auditCommand } = buildLoopCommands(workspace, "aider");
    expect(devCommand).toContain("--file ");
    expect(devCommand).toContain("developer_output.json");
    expect(devCommand).toContain("--read ");
    expect(devCommand).toContain("auditor_output.json");
    expect(devCommand).toContain("--yes-always");
    expect(devCommand).toContain("--no-auto-commits");
    expect(devCommand).toContain("--no-git");
    expect(devCommand).toContain("Write Target file");
    expect(auditCommand).toContain("auditor_output.json");
    expect(auditCommand).toContain("developer_output.json");
  });

  it("builds openhands headless CLI commands", () => {
    const workspace = repoRoot();
    const { devCommand } = buildLoopCommands(workspace, "openhands");
    expect(devCommand).toContain("openhands --headless");
    expect(devCommand).toContain("--override-with-envs");
    expect(devCommand).toContain("--exit-without-confirmation");
    expect(devCommand).toContain("OPENHANDS_SUPPRESS_BANNER");
    expect(devCommand).toContain("file editor tools");
  });

  it("builds openhands-sdk python runner commands", () => {
    const workspace = repoRoot();
    const { devCommand } = buildLoopCommands(workspace, "openhands-sdk");
    expect(devCommand).toContain("openhands-loop.py");
    expect(devCommand).toContain("--prompt-file");
    expect(devCommand).toContain("--workspace");
    expect(devCommand).toContain(workspace);
  });

  it("builds opencode run commands with workspace and context files", () => {
    const workspace = repoRoot();
    const { devCommand } = buildLoopCommands(workspace, "opencode");
    expect(devCommand).toContain("opencode run");
    expect(devCommand).toContain("--dir ");
    expect(devCommand).toContain("--dangerously-skip-permissions");
    expect(devCommand).toContain("developer_output.json");
    expect(devCommand).toContain("shared_context.txt");
  });

  it("builds antigravity print-mode commands", () => {
    const { devCommand } = buildLoopCommands(repoRoot(), "antigravity");
    expect(devCommand).toContain("agy --dangerously-skip-permissions");
    expect(devCommand).toContain("-p ");
    expect(devCommand).toContain("Write Target file");
  });

  it("builds copilot programmatic commands", () => {
    const workspace = repoRoot();
    const { devCommand } = buildLoopCommands(workspace, "copilot");
    expect(devCommand).toContain("copilot --allow-all-tools");
    expect(devCommand).toContain("--add-dir ");
    expect(devCommand).toContain("-p ");
    expect(devCommand).toContain(workspace);
  });

  it("parseAgentEngine rejects unknown engines", () => {
    expect(() => parseAgentEngine("gpt")).toThrow(/Unsupported engine/);
    expect(parseAgentEngine("claude")).toBe("claude");
  });

  it("builds benchmark-specific prompt paths", () => {
    const prompts = resolvePromptPaths(repoRoot(), "02_ledger_consensus");
    expect(prompts.developer).toContain("02_ledger_consensus");
    expect(fs.existsSync(prompts.developer)).toBe(true);
  });

  it("throws when prompt file is missing", () => {
    expect(() => buildEngineCommand("cursor", "missing.txt")).toThrow(/Prompt file not found/);
  });
});

describe("ledger benchmark e2e", () => {
  function setupWorkspace(): string {
    const dir = makeTempDir();
    copyRecursive(
      path.join(repoRoot(), "benchmark", "02_ledger_consensus"),
      path.join(dir, "benchmark", "02_ledger_consensus"),
    );
    fs.writeFileSync(path.join(dir, "shared_context.txt"), "Task header\n", "utf8");
    fs.writeFileSync(path.join(dir, "developer_output.json"), "{}", "utf8");
    fs.writeFileSync(path.join(dir, "auditor_output.json"), "{}", "utf8");
    return dir;
  }

  it("reconcile passes validator for correct ledger implementation", () => {
    const dir = setupWorkspace();
    const mergeTarget = path.join(dir, "auth_service.js");
    execSync(`node "${fixturePath("mock-dev-ledger.mjs")}" "${path.join(dir, "developer_output.json")}"`, {
      stdio: "pipe",
    });
    execSync(`node "${fixturePath("mock-audit-pass.mjs")}" "${path.join(dir, "auditor_output.json")}"`, {
      stdio: "pipe",
    });

    const result = reconcile({
      workspace: dir,
      benchmark: "02_ledger_consensus",
      overlayMerge: false,
      config: defaultConfig(),
      paths: {
        developerOutput: path.join(dir, "developer_output.json"),
        auditorOutput: path.join(dir, "auditor_output.json"),
        sharedContext: path.join(dir, "shared_context.txt"),
        mergeTarget,
        hashHistory: path.join(dir, ".shieldedshell", "state", "hash_history.json"),
      },
    });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(mergeTarget, "utf8")).toContain("processLedger");
  });

  it("orchestrates one iteration with mock agents, locks, and benchmark gate", async () => {
    const dir = setupWorkspace();
    const mergeTarget = path.join(dir, "auth_service.js");
    const devCmd = `node "${fixturePath("mock-dev-ledger.mjs")}" "${path.join(dir, "developer_output.json")}"`;
    const auditCmd = `node "${fixturePath("mock-audit-pass.mjs")}" "${path.join(dir, "auditor_output.json")}"`;

    const result = await orchestrateDualAgentLoop({
      workspace: dir,
      config: defaultConfig(),
      devCommand: devCmd,
      auditCommand: auditCmd,
      benchmark: "02_ledger_consensus",
      mergeTarget,
      iterationDelayMs: 0,
    });

    expect(result.success).toBe(true);
    expect(result.reason).toBe("CRITICAL_SUCCESS");
    expect(fs.readFileSync(path.join(dir, "shared_context.txt"), "utf8")).toContain("CRITICAL_SUCCESS");
    expect(fs.existsSync(path.join(dir, "benchmark", "secret_developer_access.txt"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "benchmark", "secret_auditor_access.txt"))).toBe(false);
  });
});
