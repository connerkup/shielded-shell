import fs from "node:fs";
import path from "node:path";
import type { AgentEngine } from "./engines.js";
import { buildLoopCommands, parseAgentEngine } from "./engines.js";
import type { ShieldConfig } from "./config.js";
import {
  orchestrateDualAgentLoop,
  type OrchestrateOptions,
  type OrchestrateResult,
} from "./orchestrator.js";
import type { VerificationReceipt } from "./receipt.js";

export interface LoopOptions extends Omit<OrchestrateOptions, "devCommand" | "auditCommand"> {
  engine?: AgentEngine;
  devEngine?: AgentEngine;
  auditEngine?: AgentEngine;
  goal?: string;
}

export async function runAgentLoop(options: LoopOptions): Promise<OrchestrateResult> {
  const devEngineName = options.devEngine ?? options.engine;
  const auditEngineName = options.auditEngine ?? options.engine;

  if (!devEngineName || !auditEngineName) {
    throw new Error("Must provide engine or both devEngine and auditEngine");
  }

  const devEngine = parseAgentEngine(devEngineName);
  const auditEngine = parseAgentEngine(auditEngineName);

  if (options.goal) {
    initLoopWorkspace(options.workspace, options.goal);
  }

  const { devCommand, auditCommand } = buildLoopCommands(
    path.resolve(options.workspace),
    { dev: devEngine, audit: auditEngine },
    options.benchmark,
  );

  return orchestrateDualAgentLoop({
    ...options,
    devCommand,
    auditCommand,
  });
}

export function initLoopWorkspace(workspace: string, taskDescription?: string): void {
  const root = path.resolve(workspace);
  fs.mkdirSync(root, { recursive: true });
  const shared = path.join(root, "shared_context.txt");
  if (!fs.existsSync(shared)) {
    fs.writeFileSync(
      shared,
      `${taskDescription ?? "Task: ShieldedShell dual-agent session."}\nCurrent status: Initializing workspace. Awaiting Developer draft.\n`,
      "utf8",
    );
  }
  if (!fs.existsSync(path.join(root, "developer_output.json"))) {
    fs.writeFileSync(path.join(root, "developer_output.json"), "{}", "utf8");
  }
  if (!fs.existsSync(path.join(root, "auditor_output.json"))) {
    fs.writeFileSync(path.join(root, "auditor_output.json"), "{}", "utf8");
  }
}
