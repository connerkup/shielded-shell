import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, resolveWorkspace, type ShieldConfig } from "./config.js";
import { DEFAULT_AGENT_TIMEOUT_MS } from "./engine-profiles.js";
import { InterceptLog } from "./intercept.js";
import { ensureOverlay } from "./overlay.js";
import { PolicyEngine } from "./policy.js";
import { analyzeLedgerSafety } from "./solvers/interval.js";

export interface RunCommandOptions {
  cwd?: string;
  config?: ShieldConfig;
  configPath?: string;
  useOverlay?: boolean;
  shell?: boolean;
  /** sandbox = block network/secrets; agent = inherit env for LLM CLI tools */
  networkPolicy?: "sandbox" | "agent";
}

function envMode(options: RunCommandOptions): "sandbox" | "agent" {
  return options.networkPolicy ?? "sandbox";
}

export interface RunCommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

function getConfig(options: RunCommandOptions): ShieldConfig {
  return options.config ?? loadConfig(options.configPath, options.cwd ?? process.cwd());
}

function resolveCwd(options: RunCommandOptions, config: ShieldConfig): string {
  const base = options.cwd ?? process.cwd();
  return resolveWorkspace(config, base);
}

export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const config = getConfig(options);
  const workspace = resolveCwd(options, config);
  const log = new InterceptLog();
  const policy = new PolicyEngine(config, workspace);

  log.info(`Active workspace: ${workspace}`);
  policy.preflightPaths(log);

  const fullCommand = [command, ...args].join(" ");
  if (!policy.scanCommand(fullCommand, log)) {
    return Promise.resolve({ exitCode: 1, signal: null });
  }

  let execCwd = workspace;
  if (options.useOverlay ?? config.sandbox.overlayEnabled) {
    execCwd = ensureOverlay(workspace, log).overlay;
  }

  const env = policy.buildSandboxEnv(process.env, envMode(options));
  log.audit("Launching sandboxed process");

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: execCwd,
      env,
      shell: options.shell ?? false,
      stdio: "inherit",
    });
    child.on("close", (code, signal) => resolve({ exitCode: code, signal }));
  });
}

export function runCommandSync(
  commandLine: string,
  options: RunCommandOptions = {},
): RunCommandResult {
  const config = getConfig(options);
  const workspace = resolveCwd(options, config);
  const log = new InterceptLog();
  const policy = new PolicyEngine(config, workspace);

  log.info(`Active workspace: ${workspace}`);
  if (!policy.scanCommand(commandLine, log)) {
    return { exitCode: 1, signal: null };
  }

  let execCwd = workspace;
  if (options.useOverlay ?? config.sandbox.overlayEnabled) {
    execCwd = ensureOverlay(workspace, log).overlay;
  }

  const timeout =
    envMode(options) === "agent"
      ? Math.max(config.sandbox.cpuTimeoutMs, DEFAULT_AGENT_TIMEOUT_MS)
      : config.sandbox.cpuTimeoutMs;

  const result = spawnSync(commandLine, {
    cwd: execCwd,
    env: policy.buildSandboxEnv(process.env, envMode(options)),
    shell: true,
    stdio: "inherit",
    timeout,
  });

  return { exitCode: result.status, signal: result.signal };
}

export function spawnInteractiveShell(
  options: RunCommandOptions = {},
): Promise<RunCommandResult> {
  const config = getConfig(options);
  const workspace = resolveCwd(options, config);
  const log = new InterceptLog();
  const policy = new PolicyEngine(config, workspace);
  log.info(`ShieldedShell session bound to ${workspace}`);
  policy.preflightPaths(log);

  let execCwd = workspace;
  if (options.useOverlay ?? config.sandbox.overlayEnabled) {
    execCwd = ensureOverlay(workspace, log).overlay;
  }

  const shell =
    process.platform === "win32"
      ? (process.env.ComSpec ?? "cmd.exe")
      : (process.env.SHELL ?? "/bin/bash");
  const shellArgs =
    process.platform === "win32"
      ? ["/K", "echo [ShieldedShell Active: Isolated Workspace Bound]"]
      : ["-i"];

  return new Promise((resolve) => {
    const child = spawn(shell, shellArgs, {
      cwd: execCwd,
      env: policy.buildSandboxEnv(process.env, "sandbox"),
      stdio: "inherit",
    });
    child.on("close", (code, signal) => resolve({ exitCode: code, signal }));
  });
}

export function auditStaticFromFiles(
  workspace: string,
  ledgerFile?: string,
  transfersFile?: string,
): { ok: boolean; message: string } {
  if (!ledgerFile || !transfersFile) {
    return { ok: true, message: "No static audit files configured" };
  }
  const ledgerPath = path.resolve(workspace, ledgerFile);
  const transfersPath = path.resolve(workspace, transfersFile);
  if (!fs.existsSync(ledgerPath) || !fs.existsSync(transfersPath)) {
    return { ok: true, message: "Static audit files not present; skipped" };
  }
  const balances = JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Record<
    string,
    number | [number, number]
  >;
  const transfers = JSON.parse(fs.readFileSync(transfersPath, "utf8"));
  const audit = analyzeLedgerSafety(balances, transfers);
  if (!audit.safe) {
    return {
      ok: false,
      message: `Ledger unsafe: ${audit.violatingAccount} at step ${audit.violatingStep}`,
    };
  }
  return { ok: true, message: "Ledger static audit passed" };
}
