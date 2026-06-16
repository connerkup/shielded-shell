import fs from "node:fs";
import path from "node:path";

export const SUPPORTED_ENGINES = [
  "claude",
  "cline",
  "aider",
  "openhands",
  "openhands-sdk",
  "opencode",
  "antigravity",
  "copilot",
  "cursor",
  "openclaw",
] as const;
export type AgentEngine = (typeof SUPPORTED_ENGINES)[number];

export interface PromptPaths {
  developer: string;
  auditor: string;
}

export interface EngineCommandOptions {
  workspace?: string;
  /** Per-agent task timeout passed to engines that support it (e.g. Cline `-t`). */
  timeoutSeconds?: number;
  /** Dual-agent loop role; used by Aider to bind edit/read files. */
  phase?: "developer" | "auditor";
}

const CLAUDE_TOOL_HINT =
  "\n\nIMPORTANT (Claude Code): Use the Write or Edit tool to save your complete JSON response to your designated Write Target file. Do not only print to stdout.";

const CLINE_TOOL_HINT =
  "\n\nIMPORTANT (Cline): Use file write/edit tools to save your complete JSON response to your designated Write Target file. Do not only reply in chat.";

const AIDER_TOOL_HINT =
  "\n\nIMPORTANT (Aider): Edit ONLY your Write Target file from the prompt. Write the complete JSON object into that file. Do not only print to stdout.";

const OPENHANDS_TOOL_HINT =
  "\n\nIMPORTANT (OpenHands): Use file editor tools to write your complete JSON response to your designated Write Target file from the prompt. Do not only print to stdout.";

const OPENCODE_TOOL_HINT =
  "\n\nIMPORTANT (OpenCode): Use edit/write tools to save your complete JSON response to your designated Write Target file. Do not only print to stdout.";

const ANTIGRAVITY_TOOL_HINT =
  "\n\nIMPORTANT (Antigravity): Use file tools to write your complete JSON response to your designated Write Target file. Do not only print to stdout.";

const COPILOT_TOOL_HINT =
  "\n\nIMPORTANT (GitHub Copilot): Use file write tools to save your complete JSON response to your designated Write Target file. Do not only print to stdout.";

export function parseAgentEngine(value: string): AgentEngine {
  if ((SUPPORTED_ENGINES as readonly string[]).includes(value)) {
    return value as AgentEngine;
  }
  throw new Error(`Unsupported engine "${value}". Choose: ${SUPPORTED_ENGINES.join(", ")}`);
}

export function engineBinaryName(engine: AgentEngine): string {
  switch (engine) {
    case "cursor":
      return process.platform === "win32" ? "cursor-agent.cmd" : "cursor-agent";
    case "claude":
      return "claude";
    case "cline":
      return "cline";
    case "aider":
      return "aider";
    case "openhands":
      return "openhands";
    case "openhands-sdk":
      return process.platform === "win32" ? "python" : "python3";
    case "opencode":
      return "opencode";
    case "antigravity":
      return "agy";
    case "copilot":
      return "copilot";
    case "openclaw":
      return "openclaw";
  }
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

function workspacePath(workspace: string | undefined, name: string): string {
  return workspace ? path.join(workspace, name) : name;
}

function buildAiderCommand(prompt: string, options: EngineCommandOptions): string {
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const phase = options.phase ?? "developer";
  const target = phase === "developer" ? "developer_output.json" : "auditor_output.json";
  const reads =
    phase === "developer"
      ? ["shared_context.txt", "auditor_output.json"]
      : ["shared_context.txt", "developer_output.json"];

  const parts = [
    "aider",
    `--file ${shellQuote(workspacePath(workspace, target))}`,
    ...reads.map((file) => `--read ${shellQuote(workspacePath(workspace, file))}`),
    `--message ${shellQuote(`${prompt}${AIDER_TOOL_HINT}`)}`,
    "--yes-always",
    "--no-auto-commits",
    "--no-show-release-notes",
    "--no-stream",
    "--no-git",
    "--skip-sanity-check-repo",
    "--no-suggest-shell-commands",
  ];
  return parts.join(" ");
}

function buildOpenHandsCommand(prompt: string): string {
  const task = shellQuote(`${prompt}${OPENHANDS_TOOL_HINT}`);
  const command = `openhands --headless --override-with-envs --exit-without-confirmation -t ${task}`;
  return process.platform === "win32"
    ? `set OPENHANDS_SUPPRESS_BANNER=1&& ${command}`
    : `OPENHANDS_SUPPRESS_BANNER=1 ${command}`;
}

function buildOpenHandsSdkCommand(promptPath: string, options: EngineCommandOptions): string {
  const workspace = options.workspace ? path.resolve(options.workspace) : process.cwd();
  const script = path.join(packageRoot(), "scripts", "openhands-loop.py");
  const python = process.platform === "win32" ? "python" : "python3";
  return `${python} ${shellQuote(script)} --prompt-file ${shellQuote(promptPath)} --workspace ${shellQuote(workspace)}`;
}

function buildOpenCodeCommand(prompt: string, options: EngineCommandOptions): string {
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const phase = options.phase ?? "developer";
  const target = phase === "developer" ? "developer_output.json" : "auditor_output.json";
  const reads =
    phase === "developer"
      ? ["shared_context.txt", "auditor_output.json"]
      : ["shared_context.txt", "developer_output.json"];
  const files = [target, ...reads];
  const dirFlag = workspace ? `--dir ${shellQuote(workspace)} ` : "";
  const fileFlags = files.map((file) => `-f ${shellQuote(workspacePath(workspace, file))}`).join(" ");
  return `opencode run ${dirFlag}--dangerously-skip-permissions ${fileFlags} ${shellQuote(`${prompt}${OPENCODE_TOOL_HINT}`)}`;
}

function buildAntigravityCommand(prompt: string): string {
  return `agy --dangerously-skip-permissions -p ${shellQuote(`${prompt}${ANTIGRAVITY_TOOL_HINT}`)}`;
}

function buildCopilotCommand(prompt: string, options: EngineCommandOptions): string {
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const addDir = workspace ? `--add-dir ${shellQuote(workspace)} ` : "";
  return `copilot --allow-all-tools ${addDir}-p ${shellQuote(`${prompt}${COPILOT_TOOL_HINT}`)}`;
}

export function buildEngineCommand(
  engine: AgentEngine,
  promptPath: string,
  options: EngineCommandOptions = {},
): string {
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }
  let prompt = fs.readFileSync(promptPath, "utf8");
  const quoted = shellQuote(prompt);
  const cwd = options.workspace ? path.resolve(options.workspace) : undefined;

  switch (engine) {
    case "claude": {
      prompt = `${prompt}${CLAUDE_TOOL_HINT}`;
      return `claude --bare -p ${shellQuote(prompt)} --allowedTools "Read,Edit,Write,Glob,Grep" --permission-mode acceptEdits`;
    }
    case "cline": {
      prompt = `${prompt}${CLINE_TOOL_HINT}`;
      const cwdFlag = cwd ? `-c ${shellQuote(cwd)} ` : "";
      const timeout = options.timeoutSeconds ?? 900;
      return `cline ${cwdFlag}--auto-approve true -t ${timeout} ${shellQuote(prompt)}`;
    }
    case "cursor":
      return process.platform === "win32"
        ? `cursor-agent.cmd -p --trust --model auto -f ${quoted}`
        : `cursor-agent -p --trust --model auto -f ${quoted}`;
    case "aider":
      return buildAiderCommand(prompt, options);
    case "openhands":
      return buildOpenHandsCommand(prompt);
    case "openhands-sdk":
      return buildOpenHandsSdkCommand(promptPath, options);
    case "opencode":
      return buildOpenCodeCommand(prompt, options);
    case "antigravity":
      return buildAntigravityCommand(prompt);
    case "copilot":
      return buildCopilotCommand(prompt, options);
    case "openclaw":
      return `openclaw agent --message ${quoted} --json --timeout 60`;
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
