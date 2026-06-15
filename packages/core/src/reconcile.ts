import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validatorPath } from "./benchmark-gate.js";
import { consolidateSharedContext } from "./context.js";
import type { ShieldConfig } from "./config.js";
import { InterceptLog } from "./intercept.js";
import { mergeOverlay } from "./overlay.js";
import { runSecureValidator } from "./sandbox.js";
import { runBenchmarkStaticVerification } from "./static-verify.js";

export interface ReconcilePaths {
  developerOutput: string;
  auditorOutput: string;
  sharedContext: string;
  mergeTarget: string;
  hashHistory: string;
}

export interface ReconcileOptions {
  workspace: string;
  paths: ReconcilePaths;
  config: ShieldConfig;
  benchmark?: string;
  overlayMerge?: boolean;
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

function buildAuditFeedback(auditObj: Record<string, unknown>, auditText: string): string {
  let feedback = "";
  const killCriteria = auditObj.kill_criteria;
  if (Array.isArray(killCriteria) && killCriteria.length > 0) {
    feedback += `Kill Criteria:\n${killCriteria.map((item) => `- ${String(item)}`).join("\n")}\n\n`;
  }
  feedback +=
    (typeof auditObj.feedback_for_developer === "string" && auditObj.feedback_for_developer) ||
    auditText.trim() ||
    "No feedback provided by Auditor.";
  return feedback;
}

export function reconcile(options: ReconcileOptions): ReconcileResult {
  const log = new InterceptLog();
  const { developerOutput, auditorOutput, sharedContext, mergeTarget, hashHistory } =
    options.paths;

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
    consolidateSharedContext(
      sharedContext,
      buildAuditFeedback(auditObj, auditText),
      "audit_rejected",
    );
    return { success: false, reason: "Audit not passed" };
  }

  let extractedCode = typeof devObj.code === "string" ? devObj.code.trim() : "";
  if (!extractedCode) {
    const blocks: string[] = [];
    const codeRegex = /```(?:javascript|js)\r?\n([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = codeRegex.exec(devText)) !== null) {
      blocks.push(match[1]);
    }
    extractedCode = blocks.join("\n").trim() || devText.trim();
  }
  if (!extractedCode) {
    consolidateSharedContext(sharedContext, "Developer output was empty or contained no code.");
    return { success: false, reason: "No code in developer output" };
  }

  const codeHash = crypto.createHash("sha256").update(extractedCode).digest("hex");
  let history: string[] = [];
  if (fs.existsSync(hashHistory)) {
    history = JSON.parse(fs.readFileSync(hashHistory, "utf8")) as string[];
  }
  if (history.includes(codeHash)) {
    consolidateSharedContext(
      sharedContext,
      "The Developer agent fell into a regressive loop, regenerating an identical file state. Stopping execution to prevent credit burn.",
      "regressive_loop",
    );
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
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr?: Buffer }).stderr ?? "")
        : err instanceof Error
          ? err.message
          : String(err);
    consolidateSharedContext(sharedContext, `Syntax Error:\n${stderr}`);
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return { success: false, reason: "Syntax check failed" };
  }

  if (options.benchmark) {
    const staticResult = runBenchmarkStaticVerification(options.workspace, options.benchmark);
    if (staticResult.verifiedByRust) {
      log.audit("Static audit: Rust solver verified");
    } else if (staticResult.ok) {
      log.audit("Static audit: JS solver verified");
    }
    if (staticResult.poisonDetected) {
      log.audit("Static audit: poison task detected (expected for benchmark)");
    }
    if (!staticResult.ok) {
      consolidateSharedContext(
        sharedContext,
        `Static Solver Verification Failure:\n${staticResult.error ?? "Unknown static failure"}`,
      );
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      return { success: false, reason: staticResult.error ?? "Static verification failed" };
    }

    const validator = validatorPath(options.workspace, options.benchmark);
    if (fs.existsSync(validator)) {
      log.audit(`Running secure validator: ${validator}`);
      const validation = runSecureValidator(validator, tempFile);
      if (!validation.ok) {
        consolidateSharedContext(sharedContext, `Validation Failure:\n${validation.error}`);
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return { success: false, reason: validation.error ?? "Validator failed" };
      }
      log.audit("Secure validator passed");
    }
  }

  fs.writeFileSync(mergeTarget, extractedCode, "utf8");
  let mergedFiles = 0;
  if (options.overlayMerge) {
    mergedFiles = mergeOverlay(options.workspace, log);
  }

  fs.appendFileSync(
    sharedContext,
    `\n=== [Reconciler Log] Turn Succeeded at ${new Date().toISOString()} ===\nRelease merged to ${path.basename(mergeTarget)} successfully.\nCRITICAL_SUCCESS\n`,
  );

  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  return { success: true, reason: "CRITICAL_SUCCESS", mergedFiles };
}
