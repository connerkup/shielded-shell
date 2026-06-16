import fs from "node:fs";
import path from "node:path";
import type { AgentEngine } from "./engines.js";
import { buildLoopCommands } from "./engines.js";
import type { ShieldConfig } from "./config.js";
import { orchestrateDualAgentLoop, type OrchestrateOptions } from "./orchestrator.js";

export interface LoopOptions extends Omit<OrchestrateOptions, "devCommand" | "auditCommand"> {
  engine: AgentEngine;
}

export async function runAgentLoop(
  options: LoopOptions,
): Promise<{ success: boolean; iterations: number; reason: string }> {
  const { devCommand, auditCommand } = buildLoopCommands(
    path.resolve(options.workspace),
    options.engine,
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
