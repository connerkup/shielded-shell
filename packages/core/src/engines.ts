import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildFromProfile,
  ENGINE_PROFILES,
  getEngineProfile,
  resolveBinary,
  SUPPORTED_ENGINES,
  type AgentEngine,
  type EngineCommandOptions,
  type EngineProfile,
} from "./engine-profiles.js";

export {
  buildFromProfile,
  DEFAULT_AGENT_TIMEOUT_MS,
  ENGINE_PROFILES,
  getEngineProfile,
  LOOP_TOOL_HINT,
  PIPE_TASK,
  SUPPORTED_ENGINES,
  type AgentEngine,
  type EngineCommandOptions,
  type EngineProfile,
  type PhaseFileBinding,
} from "./engine-profiles.js";

export interface PromptPaths {
  developer: string;
  auditor: string;
}

export function parseAgentEngine(value: string): AgentEngine {
  if ((SUPPORTED_ENGINES as readonly string[]).includes(value)) {
    return value as AgentEngine;
  }
  throw new Error(`Unsupported engine "${value}". Choose: ${SUPPORTED_ENGINES.join(", ")}`);
}

export function engineBinaryName(engine: AgentEngine): string {
  return resolveBinary(getEngineProfile(engine));
}

export function engineProfile(engine: AgentEngine): EngineProfile {
  return getEngineProfile(engine);
}

export interface EngineHealth {
  engine: AgentEngine;
  binary: string;
  ready: boolean;
  detail: string;
}

export function checkEngineHealth(engine: AgentEngine): EngineHealth {
  const profile = getEngineProfile(engine);
  const binary = resolveBinary(profile);
  const lookupCmd = process.platform === "win32" ? "where" : "which";
  const lookup = spawnSync(lookupCmd, [binary], { encoding: "utf8" });
  if (lookup.status !== 0) {
    return { engine, binary, ready: false, detail: "not on PATH" };
  }

  if (profile.doctor?.mode === "python-import") {
    const probe = spawnSync(binary, ["-c", `import ${profile.doctor.module}`], { encoding: "utf8" });
    if (probe.status !== 0) {
      return { engine, binary, ready: false, detail: `${profile.doctor.module} not installed` };
    }
    return { engine, binary, ready: true, detail: `${binary} + ${profile.doctor.module}` };
  }

  return { engine, binary, ready: true, detail: "on PATH" };
}

export function packageRoot(): string {
  // Package root: prompts/ and scripts/ ship beside dist/ in @shieldedshell/core.
  return path.resolve(import.meta.dirname, "..");
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

export function buildEngineCommand(
  engine: AgentEngine,
  promptPath: string,
  options: EngineCommandOptions = {},
): string {
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }
  return buildFromProfile(getEngineProfile(engine), promptPath, options, packageRoot());
}

export function buildLoopCommands(
  workspace: string,
  engine: AgentEngine,
  benchmark?: string,
  options: Omit<EngineCommandOptions, "workspace"> = {},
): { devCommand: string; auditCommand: string; prompts: PromptPaths } {
  const prompts = resolvePromptPaths(workspace, benchmark);
  const engineOptions: EngineCommandOptions = { workspace, ...options };
  return {
    prompts,
    devCommand: buildEngineCommand(engine, prompts.developer, { ...engineOptions, phase: "developer" }),
    auditCommand: buildEngineCommand(engine, prompts.auditor, { ...engineOptions, phase: "auditor" }),
  };
}
