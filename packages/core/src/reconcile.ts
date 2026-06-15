import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ShieldConfig } from "./config.js";
import { InterceptLog } from "./intercept.js";
import { listOverlayChanges, mergeOverlay } from "./overlay.js";
import { runSecureValidator } from "./sandbox.js";
import { analyzeLedgerSafety } from "./solvers/interval.js";
import { evaluateApiGatewayPolicy } from "./solvers/datalog.js";

export interface ReconcilePaths {
  developerOutput: string;
  auditorOutput: string;
  sharedContext: string;
  mergeTarget: string;
  hashHistory: string;
  validator?: string;
}

export interface ReconcileOptions {
  workspace: string;
  paths: ReconcilePaths;
  config: ShieldConfig;
  benchmark?: string;
}

export interface ReconcileResult {
  success: boolean;
  reason: string;
  mergedFiles?: number;
}

function parseJSONOutput(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const block = /```json\r?\n([\s\S]*?)```/i.exec(text);
  const jsonText = (block?.[1] ?? text).trim();
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(jsonText.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error("Failed to parse JSON output");
  }
}

function consolidateSharedContext(sharedContextPath: string, feedback: string): void {
  if (!fs.existsSync(sharedContextPath)) {
    fs.writeFileSync(sharedContextPath, "Task initialized by ShieldedShell.\n", "utf8");
  }
  const header = `=== [Reconciler Log] Turn Failed at ${new Date().toISOString()} ===`;
  fs.appendFileSync(sharedContextPath, `\n${header}\n${feedback}\n`, "utf8");
}

export function reconcile(options: ReconcileOptions): ReconcileResult {
  const log = new InterceptLog();
  const {
    developerOutput,
    auditorOutput,
    sharedContext,
    mergeTarget,
    hashHistory,
    validator,
  } = options.paths;

  const devText = fs.existsSync(developerOutput) ? fs.readFileSync(developerOutput, "utf8") : "";
  const auditText = fs.existsSync(auditorOutput) ? fs.readFileSync(auditorOutput, "utf8") : "";

  let devObj: Record<string, unknown> = {};
  let auditObj: Record<string, unknown> = {};
  try {
    devObj = parseJSONOutput(devText);
  } catch (err) {
    log.emit({
      kind: "audit",
      target: "developer output",
      action: "warn",
      detail: String(err),
    });
  }
  try {
    auditObj = parseJSONOutput(auditText);
  } catch (err) {
    log.emit({
      kind: "audit",
      target: "auditor output",
      action: "warn",
      detail: String(err),
    });
  }

  if (auditObj.status !== "PASSED") {
    const feedback =
      (auditObj.feedback_for_developer as string) ||
      auditText.trim() ||
      "Auditor did not approve changes.";
    consolidateSharedContext(sharedContext, feedback);
    return { success: false, reason: "Audit not passed" };
  }

  let extractedCode = typeof devObj.code === "string" ? devObj.code.trim() : "";
  if (!extractedCode) {
    const codeMatch = /```(?:javascript|js|typescript|ts)?\r?\n([\s\S]*?)```/i.exec(devText);
    extractedCode = codeMatch?.[1]?.trim() ?? devText.trim();
  }
  if (!extractedCode) {
    consolidateSharedContext(sharedContext, "Developer output contained no code.");
    return { success: false, reason: "No code in developer output" };
  }

  const codeHash = crypto.createHash("sha256").update(extractedCode).digest("hex");
  let history: string[] = [];
  if (fs.existsSync(hashHistory)) {
    history = JSON.parse(fs.readFileSync(hashHistory, "utf8")) as string[];
  }
  if (history.includes(codeHash)) {
    consolidateSharedContext(sharedContext, "Regressive loop detected (identical code hash).");
    return { success: false, reason: "Regressive loop detected" };
  }
  history.push(codeHash);
  if (history.length > 10) history.shift();
  fs.mkdirSync(path.dirname(hashHistory), { recursive: true });
  fs.writeFileSync(hashHistory, JSON.stringify(history), "utf8");

  const tempFile = path.join(options.workspace, ".shieldedshell", "state", "temp_check.js");
  fs.mkdirSync(path.dirname(tempFile), { recursive: true });
  fs.writeFileSync(tempFile, extractedCode, "utf8");
  try {
    execSync(`node --check "${tempFile}"`, { stdio: "pipe" });
    log.audit("Syntax check passed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    consolidateSharedContext(sharedContext, `Syntax error:\n${message}`);
    return { success: false, reason: "Syntax check failed" };
  }

  if (options.config.invariants.ledger.enabled) {
    const ledgerPath = path.join(options.workspace, ".shieldedshell", "audit", "ledger.json");
    const transfersPath = path.join(options.workspace, ".shieldedshell", "audit", "transfers.json");
    if (fs.existsSync(ledgerPath) && fs.existsSync(transfersPath)) {
      const balances = JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Record<
        string,
        number | [number, number]
      >;
      const transfers = JSON.parse(fs.readFileSync(transfersPath, "utf8"));
      const audit = analyzeLedgerSafety(balances, transfers);
      if (!audit.safe) {
        consolidateSharedContext(
          sharedContext,
          `Ledger invariant failed for ${audit.violatingAccount} at step ${audit.violatingStep}`,
        );
        return { success: false, reason: "Ledger invariant failed" };
      }
      log.audit("Ledger static audit passed");
    }
  }

  if (options.config.invariants.routing.enabled) {
    const policiesPath = path.join(options.workspace, ".shieldedshell", "audit", "policies.json");
    const routesPath = path.join(options.workspace, ".shieldedshell", "audit", "routes.json");
    if (fs.existsSync(policiesPath) && fs.existsSync(routesPath)) {
      const policies = JSON.parse(fs.readFileSync(policiesPath, "utf8")) as Record<string, string>;
      const routes = JSON.parse(fs.readFileSync(routesPath, "utf8")) as Record<string, string>;
      const result = evaluateApiGatewayPolicy(policies, routes);
      if (!result.safe) {
        consolidateSharedContext(
          sharedContext,
          `Routing policy violation: ${result.violations.join(", ")}`,
        );
        return { success: false, reason: "Routing policy violation" };
      }
      log.audit("Routing static audit passed");
    }
  }

  if (options.benchmark && validator && fs.existsSync(validator)) {
    const validation = runSecureValidator(validator, tempFile);
    if (!validation.ok) {
      consolidateSharedContext(sharedContext, `Validator failed: ${validation.error}`);
      return { success: false, reason: validation.error ?? "Validator failed" };
    }
    log.audit("Secure validator passed");
  }

  fs.writeFileSync(mergeTarget, extractedCode, "utf8");
  const overlayChanges = listOverlayChanges(options.workspace);
  const mergedFiles = mergeOverlay(options.workspace, log);

  fs.appendFileSync(
    sharedContext,
    `\n=== [Reconciler Log] Turn Succeeded at ${new Date().toISOString()} ===\nCRITICAL_SUCCESS\nOverlay changes: ${overlayChanges.length}, merged: ${mergedFiles}\n`,
  );

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  return { success: true, reason: "CRITICAL_SUCCESS", mergedFiles };
}
