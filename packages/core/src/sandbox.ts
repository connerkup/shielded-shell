import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SandboxRunOptions {
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SandboxRunResult {
  status: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
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
      timeout: options.timeoutMs ?? 3000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      timedOut: Boolean(result.error && "code" in result.error && result.error.code === "ETIMEDOUT"),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function runSecureValidator(
  validatorPath: string,
  codePath: string,
  timeoutMs = 5000,
): { ok: boolean; error?: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shieldedshell-validate-"));
  const harnessPath = path.join(tempDir, "harness.mjs");
  const harnessSource = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const token = fs.readFileSync(0, 'utf8').trim();
const validatorPath = process.argv[2];
const codePath = process.argv[3];
Object.freeze(Object.prototype);
const mod = await import(pathToFileURL(path.resolve(validatorPath)).href);
const validate = mod.default ?? mod.validate ?? mod;
if (typeof validate !== 'function') throw new Error('Validator must export a function');
await validate(codePath);
process.stdout.write(token);
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
}
