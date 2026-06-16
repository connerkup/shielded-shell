import fs from "node:fs";
import path from "node:path";

/** Minimum orchestrator timeout for agent CLI runs (15 minutes). */
export const DEFAULT_AGENT_TIMEOUT_MS = 900_000;

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

export interface EngineCommandOptions {
  workspace?: string;
  /** Per-agent task timeout passed to engines that support it (e.g. Cline `-t`). */
  timeoutSeconds?: number;
  /** Dual-agent loop role; used for phase-specific file attachments. */
  phase?: "developer" | "auditor";
}

export const LOOP_TOOL_HINT =
  "\n\nIMPORTANT: Execute the agent prompt immediately. Write your complete JSON response to the Write Target file named in the prompt. Do not only reply in chat or stdout.";

export const PIPE_TASK = "Execute the piped agent prompt immediately." + LOOP_TOOL_HINT;

type PromptDelivery = "pipe-file" | "inline-prompt" | "prompt-file-arg" | "script";

type WorkspaceBinding =
  | { mode: "none" }
  | { mode: "cwd-only" }
  | { mode: "flag"; flag: string };

export interface PhaseFileBinding {
  readTargets: { developer: string[]; auditor: string[] };
  writeFlag: string;
  readFlag: string;
}

export interface EngineProfile {
  id: AgentEngine;
  binary: string | { win32: string; default: string };
  delivery: PromptDelivery;
  argvPrefix?: string[];
  promptFlag?: string;
  /** Args placed immediately before the prompt flag/body (e.g. cursor `-p --trust`). */
  promptPrefixArgs?: string[];
  /** When piping stdin, prefix the tail task with this flag (e.g. `-p`). */
  pipePromptFlag?: string;
  promptSuffixArgs?: string[];
  headlessArgs?: string[];
  autoApproveArgs?: string[];
  workspace?: WorkspaceBinding;
  timeoutFlag?: string;
  phaseFiles?: PhaseFileBinding;
  env?: Record<string, string>;
  scriptPath?: string;
  doctor?: { mode: "path" } | { mode: "python-import"; module: string };
}

export function resolveBinary(profile: EngineProfile): string {
  if (typeof profile.binary === "string") return profile.binary;
  return process.platform === "win32" ? profile.binary.win32 : profile.binary.default;
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

function phaseWriteTarget(phase: "developer" | "auditor"): string {
  return phase === "developer" ? "developer_output.json" : "auditor_output.json";
}

function pipePrefix(promptPath: string): string {
  return process.platform === "win32"
    ? `type ${shellQuote(promptPath)} | `
    : `cat ${shellQuote(promptPath)} | `;
}

function envPrefix(env: Record<string, string>): string {
  if (process.platform === "win32") {
    return `${Object.entries(env)
      .map(([key, value]) => `set ${key}=${value}`)
      .join("&&")}&& `;
  }
  return `${Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ")} `;
}

function workspaceArgs(profile: EngineProfile, workspace: string | undefined): string[] {
  if (!profile.workspace || profile.workspace.mode === "none" || !workspace) return [];
  if (profile.workspace.mode === "cwd-only") return [];
  return [`${profile.workspace.flag} ${shellQuote(path.resolve(workspace))}`];
}

function phaseFileArgs(
  binding: PhaseFileBinding,
  phase: "developer" | "auditor",
  workspace: string | undefined,
): string[] {
  const target = phaseWriteTarget(phase);
  const reads = phase === "developer" ? binding.readTargets.developer : binding.readTargets.auditor;
  return [
    `${binding.writeFlag} ${shellQuote(workspacePath(workspace, target))}`,
    ...reads.map((file) => `${binding.readFlag} ${shellQuote(workspacePath(workspace, file))}`),
  ];
}

function timeoutArgs(profile: EngineProfile, timeoutSeconds: number): string[] {
  if (!profile.timeoutFlag) return [];
  return [`${profile.timeoutFlag} ${timeoutSeconds}`];
}

function pipeTail(profile: EngineProfile): string[] {
  if (profile.pipePromptFlag) {
    return [profile.pipePromptFlag, shellQuote(PIPE_TASK)];
  }
  return [shellQuote(PIPE_TASK)];
}

export function buildFromProfile(
  profile: EngineProfile,
  promptPath: string,
  options: EngineCommandOptions,
  packageRoot: string,
): string {
  const workspace = options.workspace ? path.resolve(options.workspace) : undefined;
  const phase = options.phase ?? "developer";
  const timeoutSeconds = options.timeoutSeconds ?? 900;
  const binary = resolveBinary(profile);

  if (profile.delivery === "script") {
    if (!profile.scriptPath) {
      throw new Error(`Engine profile "${profile.id}" is missing scriptPath`);
    }
    const python = process.platform === "win32" ? "python" : "python3";
    const script = path.join(packageRoot, profile.scriptPath);
    return `${python} ${shellQuote(script)} --prompt-file ${shellQuote(promptPath)} --workspace ${shellQuote(workspace ?? process.cwd())}`;
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const promptWithHint = `${prompt}${LOOP_TOOL_HINT}`;

  const parts: string[] = [];
  if (profile.env) parts.push(envPrefix(profile.env));
  if (profile.delivery === "pipe-file") parts.push(pipePrefix(promptPath));

  parts.push(binary);
  if (profile.argvPrefix?.length) parts.push(...profile.argvPrefix);
  parts.push(...workspaceArgs(profile, workspace));
  if (profile.headlessArgs?.length) parts.push(...profile.headlessArgs);
  if (profile.autoApproveArgs?.length) parts.push(...profile.autoApproveArgs);
  parts.push(...timeoutArgs(profile, timeoutSeconds));
  if (profile.phaseFiles) parts.push(...phaseFileArgs(profile.phaseFiles, phase, workspace));

  switch (profile.delivery) {
    case "pipe-file":
      parts.push(...pipeTail(profile));
      break;
    case "prompt-file-arg":
      parts.push("-f", shellQuote(promptPath));
      if (profile.promptSuffixArgs?.length) parts.push(...profile.promptSuffixArgs);
      break;
    case "inline-prompt":
      if (profile.promptPrefixArgs?.length) parts.push(...profile.promptPrefixArgs);
      if (profile.promptFlag) {
        parts.push(profile.promptFlag, shellQuote(promptWithHint));
      } else {
        parts.push(shellQuote(promptWithHint));
      }
      if (profile.promptSuffixArgs?.length) parts.push(...profile.promptSuffixArgs);
      break;
    default:
      break;
  }

  return parts.join(" ");
}

const LOOP_PHASE_FILES: PhaseFileBinding = {
  readTargets: {
    developer: ["shared_context.txt", "auditor_output.json"],
    auditor: ["shared_context.txt", "developer_output.json"],
  },
  writeFlag: "--file",
  readFlag: "--read",
};

const ATTACH_PHASE_FILES: PhaseFileBinding = {
  readTargets: {
    developer: ["shared_context.txt", "auditor_output.json"],
    auditor: ["shared_context.txt", "developer_output.json"],
  },
  writeFlag: "-f",
  readFlag: "-f",
};

/** Declarative profiles — extend this table to add engines without new builder code. */
export const ENGINE_PROFILES: Record<AgentEngine, EngineProfile> = {
  claude: {
    id: "claude",
    binary: "claude",
    delivery: "inline-prompt",
    argvPrefix: ["--bare"],
    promptFlag: "-p",
    autoApproveArgs: [
      '--allowedTools "Read,Edit,Write,Glob,Grep"',
      "--permission-mode acceptEdits",
    ],
    doctor: { mode: "path" },
  },
  cline: {
    id: "cline",
    binary: "cline",
    delivery: "pipe-file",
    headlessArgs: ["--json"],
    autoApproveArgs: ["--auto-approve", "true"],
    workspace: { mode: "flag", flag: "-c" },
    timeoutFlag: "-t",
    doctor: { mode: "path" },
  },
  aider: {
    id: "aider",
    binary: "aider",
    delivery: "inline-prompt",
    promptFlag: "--message",
    autoApproveArgs: [
      "--yes-always",
      "--no-auto-commits",
      "--no-show-release-notes",
      "--no-stream",
      "--no-git",
      "--skip-sanity-check-repo",
      "--no-suggest-shell-commands",
    ],
    workspace: { mode: "cwd-only" },
    phaseFiles: LOOP_PHASE_FILES,
    doctor: { mode: "path" },
  },
  openhands: {
    id: "openhands",
    binary: "openhands",
    delivery: "inline-prompt",
    promptFlag: "-t",
    headlessArgs: ["--headless", "--override-with-envs", "--exit-without-confirmation"],
    env: { OPENHANDS_SUPPRESS_BANNER: "1" },
    doctor: { mode: "path" },
  },
  "openhands-sdk": {
    id: "openhands-sdk",
    binary: process.platform === "win32" ? "python" : "python3",
    delivery: "script",
    scriptPath: "scripts/openhands-loop.py",
    doctor: { mode: "python-import", module: "openhands.sdk" },
  },
  opencode: {
    id: "opencode",
    binary: "opencode",
    delivery: "inline-prompt",
    argvPrefix: ["run"],
    headlessArgs: ["--dangerously-skip-permissions"],
    workspace: { mode: "flag", flag: "--dir" },
    phaseFiles: ATTACH_PHASE_FILES,
    doctor: { mode: "path" },
  },
  antigravity: {
    id: "antigravity",
    binary: "agy",
    delivery: "inline-prompt",
    promptFlag: "-p",
    autoApproveArgs: ["--dangerously-skip-permissions"],
    doctor: { mode: "path" },
  },
  copilot: {
    id: "copilot",
    binary: "copilot",
    delivery: "inline-prompt",
    promptFlag: "-p",
    autoApproveArgs: ["--allow-all-tools"],
    workspace: { mode: "flag", flag: "--add-dir" },
    doctor: { mode: "path" },
  },
  cursor: {
    id: "cursor",
    binary: { win32: "cursor-agent.cmd", default: "cursor-agent" },
    delivery: "inline-prompt",
    promptPrefixArgs: ["-p", "--trust", "--model", "auto"],
    promptFlag: "-f",
    doctor: { mode: "path" },
  },
  openclaw: {
    id: "openclaw",
    binary: "openclaw",
    delivery: "inline-prompt",
    argvPrefix: ["agent"],
    promptFlag: "--message",
    headlessArgs: ["--json", "--timeout", "60"],
    doctor: { mode: "path" },
  },
};

export function getEngineProfile(engine: AgentEngine): EngineProfile {
  return ENGINE_PROFILES[engine];
}
