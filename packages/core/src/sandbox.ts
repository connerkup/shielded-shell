import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_CPU_TIMEOUT_MS = 30_000;
export const DEFAULT_KILL_GRACE_PERIOD_MS = 1500;

export interface SandboxRunOptions {
  timeoutMs?: number;
  gracePeriodMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  antiSpoofToken?: string;
}

export interface SandboxRunResult {
  status: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  tokenVerified?: boolean;
}

export function generateAntiSpoofToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyAntiSpoofToken(output: string, token: string): boolean {
  if (!output || !token) return false;
  return output.includes(token.trim());
}

export function runSandboxedNodeScript(
  script: string,
  options: SandboxRunOptions = {},
): SandboxRunResult {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-sandbox-"));
  const scriptPath = path.join(tempDir, "script.mjs");
  fs.writeFileSync(scriptPath, script, "utf8");
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      timeout: options.timeoutMs ?? DEFAULT_CPU_TIMEOUT_MS,
      killSignal: "SIGKILL",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = result.stdout ?? "";
    const timedOut = Boolean(result.error && "code" in result.error && result.error.code === "ETIMEDOUT");
    const tokenVerified = options.antiSpoofToken
      ? verifyAntiSpoofToken(stdout, options.antiSpoofToken)
      : undefined;

    return {
      status: result.status ?? (timedOut ? 124 : 1),
      stdout,
      stderr: result.stderr ?? "",
      timedOut,
      tokenVerified,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function runSandboxedNodeScriptAsync(
  script: string,
  options: SandboxRunOptions = {},
): Promise<SandboxRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CPU_TIMEOUT_MS;
  const gracePeriodMs = options.gracePeriodMs ?? DEFAULT_KILL_GRACE_PERIOD_MS;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-sandbox-"));
  const scriptPath = path.join(tempDir, "script.mjs");
  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let termTimer: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;

    const child = spawn(process.execPath, [scriptPath], {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      termTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {}

        killTimer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {}
        }, gracePeriodMs);
        killTimer.unref?.();
      }, timeoutMs);
      termTimer.unref?.();
    }

    child.on("close", (code) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);
      fs.rmSync(tempDir, { recursive: true, force: true });
      const tokenVerified = options.antiSpoofToken
        ? verifyAntiSpoofToken(stdout, options.antiSpoofToken)
        : undefined;

      resolve({
        status: code ?? (timedOut ? 124 : 1),
        stdout,
        stderr,
        timedOut,
        tokenVerified,
      });
    });

    child.on("error", (err) => {
      if (termTimer) clearTimeout(termTimer);
      if (killTimer) clearTimeout(killTimer);
      fs.rmSync(tempDir, { recursive: true, force: true });
      resolve({
        status: 1,
        stdout,
        stderr: stderr || err.message,
        timedOut,
      });
    });
  });
}

export function runSecureValidator(
  validatorPath: string,
  codePath: string,
  timeoutMs = 5000,
): { ok: boolean; error?: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-validate-"));
  const harnessPath = path.join(tempDir, "harness.cjs");
  const harnessSource = `
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

(function() {
  try {
    const token = fs.readFileSync(0, 'utf8').trim();
    const validator = process.argv[2];
    const tempFile = process.argv[3];
    if (!validator || !tempFile || !token) {
      throw new Error('Missing arguments or token in secure validator harness');
    }

    Object.freeze(Object.prototype);
    Object.freeze(fs);
    Object.freeze(path);
    Object.freeze(process);
    Object.freeze(cp);
    Object.freeze(require('module'));

    const validate = require(path.resolve(validator));
    validate(tempFile);
    process.stdout.write(token);
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
`;
  fs.writeFileSync(harnessPath, harnessSource, "utf8");

  const run = spawnSync(process.execPath, [harnessPath, validatorPath, codePath], {
    input: token,
    encoding: "utf8",
    timeout: timeoutMs,
    stdio: ["pipe", "pipe", "pipe"],
  });

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (run.error && "code" in run.error && run.error.code === "ETIMEDOUT") {
    return { ok: false, error: "Validation timed out" };
  }
  const stdout = (run.stdout ?? "").trim();
  const stderr = (run.stderr ?? "").trim();
  if (run.status !== 0 || stdout !== token) {
    return { ok: false, error: stderr || "Validation failed" };
  }
  return { ok: true };
}

export class SecureSandbox {
  constructor(
    private options: {
      timeoutMs?: number;
      memoryLimitMb?: number;
      allowNetwork?: boolean;
      allowFilesystem?: boolean;
    } = {},
  ) {}

  run(code: string): SandboxRunResult {
    const wrapped = `
Object.freeze(Object.prototype);
${this.options.allowFilesystem ? "" : "globalThis.require = undefined;"}
try {
  ${code}
} catch (err) {
  console.error(err?.message ?? err);
  process.exit(1);
}
`;
    return runSandboxedNodeScript(wrapped, { timeoutMs: this.options.timeoutMs ?? 3000 });
  }

  runAsync(code: string): Promise<SandboxRunResult> {
    const wrapped = `
Object.freeze(Object.prototype);
${this.options.allowFilesystem ? "" : "globalThis.require = undefined;"}
try {
  ${code}
} catch (err) {
  console.error(err?.message ?? err);
  process.exit(1);
}
`;
    return runSandboxedNodeScriptAsync(wrapped, { timeoutMs: this.options.timeoutMs ?? DEFAULT_CPU_TIMEOUT_MS });
  }
}
