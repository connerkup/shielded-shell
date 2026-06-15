import fs from "node:fs";
import path from "node:path";
import type { ShieldConfig } from "./config.js";
import { InterceptLog } from "./intercept.js";
import { overlayPaths, resetOverlay } from "./overlay.js";
import { reconcile, type ReconcilePaths } from "./reconcile.js";
import { runCommandSync } from "./runner.js";

export interface OrchestrateOptions {
  workspace: string;
  config: ShieldConfig;
  devCommand: string;
  auditCommand: string;
  maxIterations?: number;
  benchmark?: string;
  mergeTarget?: string;
}

function defaultPaths(workspace: string, mergeTarget: string): ReconcilePaths {
  const state = overlayPaths(workspace).stateDir;
  return {
    developerOutput: path.join(workspace, "developer_output.json"),
    auditorOutput: path.join(workspace, "auditor_output.json"),
    sharedContext: path.join(workspace, "shared_context.txt"),
    mergeTarget,
    hashHistory: path.join(state, "hash_history.json"),
    validator: undefined,
  };
}

function initBuffers(workspace: string, mergeTarget: string): void {
  fs.mkdirSync(path.dirname(mergeTarget), { recursive: true });
  if (!fs.existsSync(path.join(workspace, "shared_context.txt"))) {
    fs.writeFileSync(
      path.join(workspace, "shared_context.txt"),
      "Task: ShieldedShell dual-agent session.\n",
      "utf8",
    );
  }
  if (!fs.existsSync(path.join(workspace, "developer_output.json"))) {
    fs.writeFileSync(path.join(workspace, "developer_output.json"), "{}", "utf8");
  }
  if (!fs.existsSync(path.join(workspace, "auditor_output.json"))) {
    fs.writeFileSync(path.join(workspace, "auditor_output.json"), "{}", "utf8");
  }
  if (!fs.existsSync(mergeTarget)) {
    fs.writeFileSync(mergeTarget, "", "utf8");
  }
}

export async function orchestrateDualAgentLoop(
  options: OrchestrateOptions,
): Promise<{ success: boolean; iterations: number; reason: string }> {
  const log = new InterceptLog();
  const workspace = path.resolve(options.workspace);
  const mergeTarget = path.resolve(options.mergeTarget ?? path.join(workspace, "output.js"));
  const maxIterations = options.maxIterations ?? options.config.autoHeal.maxRetryCycles;
  const paths = defaultPaths(workspace, mergeTarget);
  if (options.benchmark) {
    paths.validator = path.join(workspace, "benchmark", options.benchmark, "validate.js");
  }

  resetOverlay(workspace);
  initBuffers(workspace, mergeTarget);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    log.info(`Orchestration iteration ${iteration}/${maxIterations}`);

    log.audit("Developer agent run");
    const devResult = runCommandSync(options.devCommand, {
      cwd: workspace,
      config: options.config,
      useOverlay: true,
    });
    if (devResult.exitCode !== 0) {
      return {
        success: false,
        iterations: iteration,
        reason: `Developer command failed with exit ${devResult.exitCode}`,
      };
    }

    log.audit("Architect agent run");
    const auditResult = runCommandSync(options.auditCommand, {
      cwd: workspace,
      config: options.config,
      useOverlay: true,
    });
    if (auditResult.exitCode !== 0) {
      return {
        success: false,
        iterations: iteration,
        reason: `Auditor command failed with exit ${auditResult.exitCode}`,
      };
    }

    const result = reconcile({
      workspace,
      paths,
      config: options.config,
      benchmark: options.benchmark,
    });

    if (result.success) {
      return { success: true, iterations: iteration, reason: result.reason };
    }

    log.emit({
      kind: "audit",
      target: result.reason,
      action: "warn",
      detail: "retrying developer",
    });
  }

  return {
    success: false,
    iterations: maxIterations,
    reason: "Max iterations exceeded without CRITICAL_SUCCESS",
  };
}
