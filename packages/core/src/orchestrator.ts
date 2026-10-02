import fs from "node:fs";
import path from "node:path";
import {
  exposeAuditorSecret,
  exposeDeveloperSecret,
  hideBenchmarkSecrets,
  validatorPath,
} from "./benchmark-gate.js";
import type { ShieldConfig } from "./config.js";
import { appendGovernorInterrupt } from "./context.js";
import { InterceptLog } from "./intercept.js";
import { overlayPaths } from "./overlay.js";
import { reconcile, type ReconcilePaths } from "./reconcile.js";
import { runCommandSync } from "./runner.js";
import { applyPhaseLocks, restoreAllWritable, type PartitionTargets } from "./spatial.js";
import { generateReceipt, type VerificationReceipt } from "./receipt.js";

export interface OrchestrateOptions {
  workspace: string;
  config: ShieldConfig;
  devCommand: string;
  auditCommand: string;
  maxIterations?: number;
  benchmark?: string;
  mergeTarget?: string;
  iterationDelayMs?: number;
}

export interface OrchestrateResult {
  success: boolean;
  iterations: number;
  reason: string;
  receipt: VerificationReceipt;
}

function defaultPaths(workspace: string, mergeTarget: string): ReconcilePaths {
  const state = overlayPaths(workspace).stateDir;
  return {
    developerOutput: path.join(workspace, "developer_output.json"),
    auditorOutput: path.join(workspace, "auditor_output.json"),
    sharedContext: path.join(workspace, "shared_context.txt"),
    mergeTarget,
    hashHistory: path.join(state, "hash_history.json"),
  };
}

function toPartition(targets: ReconcilePaths): PartitionTargets {
  return {
    developerOutput: targets.developerOutput,
    auditorOutput: targets.auditorOutput,
    sharedContext: targets.sharedContext,
    mergeTarget: targets.mergeTarget,
  };
}

function initBuffers(workspace: string, mergeTarget: string): void {
  fs.mkdirSync(path.dirname(mergeTarget), { recursive: true });
  if (!fs.existsSync(path.join(workspace, "shared_context.txt"))) {
    fs.writeFileSync(
      path.join(workspace, "shared_context.txt"),
      "Task: ShieldedShell dual-agent session.\nCurrent status: Initializing workspace. Awaiting Developer draft.\n",
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

function hasCriticalSuccess(sharedContextPath: string): boolean {
  if (!fs.existsSync(sharedContextPath)) return false;
  return fs.readFileSync(sharedContextPath, "utf8").includes("CRITICAL_SUCCESS");
}

export async function orchestrateDualAgentLoop(
  options: OrchestrateOptions,
): Promise<OrchestrateResult> {
  const log = new InterceptLog();
  const workspace = path.resolve(options.workspace);
  const mergeTarget = path.resolve(options.mergeTarget ?? path.join(workspace, "output.js"));
  const maxIterations = options.maxIterations ?? options.config.autoHeal.maxRetryCycles;
  const paths = defaultPaths(workspace, mergeTarget);
  const partition = toPartition(paths);
  const iterationDelayMs = options.iterationDelayMs ?? 2000;

  hideBenchmarkSecrets(workspace);
  initBuffers(workspace, mergeTarget);
  restoreAllWritable(partition);

  if (fs.existsSync(paths.hashHistory)) {
    fs.unlinkSync(paths.hashHistory);
  }

  function finalize(success: boolean, iterations: number, reason: string): OrchestrateResult {
    restoreAllWritable(partition);
    hideBenchmarkSecrets(workspace);

    const receipt = generateReceipt({
      workspace,
      success,
      iterations,
      reason,
      benchmark: options.benchmark,
      mergeTarget,
    });

    try {
      const stateDir = overlayPaths(workspace).stateDir;
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(stateDir, "receipt.json"),
        JSON.stringify(receipt, null, 2),
        "utf8",
      );
    } catch {}

    log.info(`Verification receipt generated: ${receipt.id}`);
    return {
      success,
      iterations,
      reason,
      receipt,
    };
  }

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    log.info(`Orchestration iteration ${iteration}/${maxIterations}`);

    applyPhaseLocks("developer", partition);
    if (options.benchmark) {
      exposeDeveloperSecret(workspace, options.benchmark);
    }

    log.audit("Developer agent run");
    const devResult = runCommandSync(options.devCommand, {
      cwd: workspace,
      config: options.config,
      useOverlay: false,
      networkPolicy: "agent",
    });
    if (devResult.exitCode !== 0) {
      return finalize(false, iteration, `Developer command failed with exit ${devResult.exitCode}`);
    }

    applyPhaseLocks("auditor", partition);
    if (options.benchmark) {
      exposeAuditorSecret(workspace, options.benchmark);
    }

    log.audit("Architect agent run");
    const auditResult = runCommandSync(options.auditCommand, {
      cwd: workspace,
      config: options.config,
      useOverlay: false,
      networkPolicy: "agent",
    });
    if (auditResult.exitCode !== 0) {
      return finalize(false, iteration, `Auditor command failed with exit ${auditResult.exitCode}`);
    }

    applyPhaseLocks("reconcile", partition);
    if (options.benchmark) {
      hideBenchmarkSecrets(workspace);
    }

    log.audit("Reconciler gate");
    const result = reconcile({
      workspace,
      paths,
      config: options.config,
      benchmark: options.benchmark,
      overlayMerge: false,
    });

    restoreAllWritable(partition);

    if (result.success || hasCriticalSuccess(paths.sharedContext)) {
      return finalize(true, iteration, result.reason);
    }

    log.emit({
      kind: "audit",
      target: result.reason,
      action: "warn",
      detail: "retrying developer",
    });

    if (iteration < maxIterations) {
      await new Promise((resolve) => setTimeout(resolve, iterationDelayMs));
    }
  }

  appendGovernorInterrupt(paths.sharedContext, maxIterations);
  return finalize(false, maxIterations, "INTERRUPT_REQUIRED");
}

export { validatorPath, generateReceipt, type VerificationReceipt };
