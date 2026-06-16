import fs from "node:fs";
import path from "node:path";

export type AgentEngine = "cursor" | "aider" | "openclaw" | "cline";

export interface PromptPaths {
  developer: string;
  auditor: string;
}

export function packageRoot(): string {
  return path.resolve(import.meta.dirname, "..", "..", "..");
}

export function resolvePromptPaths(workspace: string, benchmark?: string): PromptPaths {
  if (benchmark) {
    const base = path.join(workspace, "benchmark", benchmark);
    return {
      developer: path.join(base, "agent_a_prompt.txt"),
      auditor: path.join(base, "agent_b_prompt.txt"),
    };
  }

  const repoPrompts = path.join(packageRoot(), "prompts");
  const workspacePrompts = path.join(workspace, "prompts");
  const devName = "agent_a_prompt.txt";
  const auditName = "agent_b_prompt.txt";

  return {
    developer: fs.existsSync(path.join(workspacePrompts, devName))
      ? path.join(workspacePrompts, devName)
      : path.join(repoPrompts, devName),
    auditor: fs.existsSync(path.join(workspacePrompts, auditName))
      ? path.join(workspacePrompts, auditName)
      : path.join(repoPrompts, auditName),
  };
}

function shellQuote(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildEngineCommand(engine: AgentEngine, promptPath: string): string {
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }
  const prompt = fs.readFileSync(promptPath, "utf8");
  const quoted = shellQuote(prompt);

  switch (engine) {
    case "cursor":
      return `cursor-agent.cmd -p --trust --model auto -f ${quoted}`;
    case "aider":
      return `aider --message ${quoted} --yes`;
    case "openclaw":
      return `openclaw agent --message ${quoted} --json --timeout 60`;
    case "cline":
      return `cline --prompt ${quoted}`;
    default: {
      const exhaustive: never = engine;
      throw new Error(`Unsupported engine: ${exhaustive}`);
    }
  }
}

export function buildLoopCommands(
  workspace: string,
  engine: AgentEngine,
  benchmark?: string,
): { devCommand: string; auditCommand: string; prompts: PromptPaths } {
  const prompts = resolvePromptPaths(workspace, benchmark);
  return {
    prompts,
    devCommand: buildEngineCommand(engine, prompts.developer),
    auditCommand: buildEngineCommand(engine, prompts.auditor),
  };
}
