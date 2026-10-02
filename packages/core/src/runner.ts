import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, resolveWorkspace, type ShieldConfig } from "./config.js";
import { DEFAULT_AGENT_TIMEOUT_MS } from "./engine-profiles.js";
import { InterceptLog } from "./intercept.js";
import { createEphemeralOverlay, ensureOverlay, type EphemeralOverlay } from "./overlay.js";
import { PolicyEngine } from "./policy.js";
import { generateAntiSpoofToken, verifyAntiSpoofToken } from "./sandbox.js";
import { analyzeLedgerSafety } from "./solvers/interval.js";

export interface RunCommandOptions {
  cwd?: string;
  config?: ShieldConfig;
  configPath?: string;
  useOverlay?: boolean;
  ephemeral?: boolean;
  antiSpoof?: boolean;
  antiSpoofToken?: string;
  timeoutMs?: number;
  gracePeriodMs?: number;
  shell?: boolean;
  /** sandbox = block network/secrets; agent = inherit env for LLM CLI tools */
  networkPolicy?: "sandbox" | "agent";
  stdio?: "inherit" | "pipe";
}

function envMode(options: RunCommandOptions): "sandbox" | "agent" {
  return options.networkPolicy ?? "sandbox";
}

export interface RunCommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut?: boolean;
  tokenVerified?: boolean;
  antiSpoofToken?: string;
  diffs?: string[];
  stdout?: string;
  stderr?: string;
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
  let ephemeral: EphemeralOverlay | null = null;

  if (options.ephemeral) {
    ephemeral = createEphemeralOverlay(workspace, log);
    execCwd = ephemeral.tempDir;
  } else if (options.useOverlay ?? config.sandbox.overlayEnabled) {
    execCwd = ensureOverlay(workspace, log).overlay;
  }

  const env = policy.buildSandboxEnv(process.env, envMode(options));

  const antiSpoof = Boolean(options.antiSpoof || options.antiSpoofToken);
  const token = antiSpoof
    ? (options.antiSpoofToken ?? generateAntiSpoofToken())
    : undefined;

  if (token) {
    env.SHIELDEDSHELL_ASSERTION_TOKEN = token;
    env.SHIELD_ASSERTION_TOKEN = token;
  }

  const timeoutMs =
    options.timeoutMs ??
    (envMode(options) === "agent"
      ? Math.max(config.sandbox.cpuTimeoutMs, DEFAULT_AGENT_TIMEOUT_MS)
      : config.sandbox.cpuTimeoutMs);
  const gracePeriodMs = options.gracePeriodMs ?? 1500;

  log.audit("Launching sandboxed process");

  return new Promise((resolve) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let timedOut = false;
    let termTimer: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;

    const usePipedStdio = antiSpoof || options.stdio === "pipe";

    const child = spawn(command, args, {
      cwd: execCwd,
      env,
      shell: options.shell ?? false,
      stdio: usePipedStdio ? ["pipe", "pipe", "pipe"] : "inherit",
    });

    if (usePipedStdio) {
      if (token && child.stdin) {
        child.stdin.write(`${token}\n`);
        child.stdin.end();
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString("utf8");
        if (options.stdio !== "pipe") {
          process.stdout.write(chunk);
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf8");
        if (options.stdio !== "pipe") {
          process.stderr.write(chunk);
        }
      });
    }

    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      termTimer = setTimeout(() => {
        timedOut = true;
        log.emit({
          kind: "audit",
          target: fullCommand,
          action: "blocked",
          detail: `cpuTimeoutMs (${timeoutMs}ms) exceeded, sending SIGTERM`,
        });
        try {
          child.kill("SIGTERM");
        } catch {}

        killTimer = setTimeout(() => {
          log.emit({
            kind: "audit",
            target: fullCommand,
            action: "blocked",
            detail: `SIGTERM grace period (${gracePeriodMs}ms) expired, escalating to SIGKILL`,
          });
          try {
            child.kill("SIGKILL");
          } catch {}
        }, gracePeriodMs);
        killTimer.unref?.();
      }, timeoutMs);
      termTimer.unref?.();
    }

    child.on("close", (code, signal) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);

      let diffs: string[] | undefined;
      if (ephemeral) {
        diffs = ephemeral.captureDiffs();
        ephemeral.rollback();
      }

      let exitCode = code ?? (timedOut ? 124 : null);
      let tokenVerified: boolean | undefined;

      if (token) {
        tokenVerified = verifyAntiSpoofToken(stdoutBuffer, token);
        if (exitCode === 0 && !tokenVerified) {
          log.emit({
            kind: "audit",
            target: fullCommand,
            action: "blocked",
            detail: "anti-spoof assertion verification failed: token not found in output",
          });
          exitCode = 1;
        }
      }

      resolve({
        exitCode,
        signal,
        timedOut,
        tokenVerified,
        antiSpoofToken: token,
        diffs,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
      });
    });

    child.on("error", (err) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);
      if (ephemeral) {
        ephemeral.rollback();
      }
      resolve({
        exitCode: 1,
        signal: null,
        timedOut,
        stderr: stderrBuffer || err.message,
      });
    });
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
  let ephemeral: EphemeralOverlay | null = null;

  if (options.ephemeral) {
    ephemeral = createEphemeralOverlay(workspace, log);
    execCwd = ephemeral.tempDir;
  } else if (options.useOverlay ?? config.sandbox.overlayEnabled) {
    execCwd = ensureOverlay(workspace, log).overlay;
  }

  const antiSpoof = Boolean(options.antiSpoof || options.antiSpoofToken);
  const token = antiSpoof
    ? (options.antiSpoofToken ?? generateAntiSpoofToken())
    : undefined;

  const env = policy.buildSandboxEnv(process.env, envMode(options));
  if (token) {
    env.SHIELDEDSHELL_ASSERTION_TOKEN = token;
    env.SHIELD_ASSERTION_TOKEN = token;
  }

  const timeout =
    options.timeoutMs ??
    (envMode(options) === "agent"
      ? Math.max(config.sandbox.cpuTimeoutMs, DEFAULT_AGENT_TIMEOUT_MS)
      : config.sandbox.cpuTimeoutMs);

  try {
    const usePiped = antiSpoof || options.stdio === "pipe";
    const result = spawnSync(commandLine, {
      cwd: execCwd,
      env,
      shell: true,
      encoding: "utf8",
      stdio: usePiped ? ["pipe", "pipe", "pipe"] : "inherit",
      input: token ? `${token}\n` : undefined,
      timeout,
      killSignal: "SIGKILL",
    });

    let diffs: string[] | undefined;
    if (ephemeral) {
      diffs = ephemeral.captureDiffs();
      ephemeral.rollback();
      ephemeral = null;
    }

    const timedOut = Boolean(
      result.error && "code" in result.error && result.error.code === "ETIMEDOUT",
    );
    let exitCode = result.status ?? (timedOut ? 124 : 1);
    let tokenVerified: boolean | undefined;

    if (token) {
      const stdout = result.stdout ?? "";
      tokenVerified = verifyAntiSpoofToken(stdout, token);
      if (exitCode === 0 && !tokenVerified) {
        log.emit({
          kind: "audit",
          target: commandLine,
          action: "blocked",
          detail: "anti-spoof assertion verification failed: token not found in output",
        });
        exitCode = 1;
      }
    }

    return {
      exitCode,
      signal: result.signal,
      timedOut,
      tokenVerified,
      antiSpoofToken: token,
      diffs,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    if (ephemeral) {
      ephemeral.rollback();
    }
  }
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
