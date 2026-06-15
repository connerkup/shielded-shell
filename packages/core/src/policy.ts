import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ShieldConfig } from "./config.js";
import type { InterceptLog } from "./intercept.js";

function expandHome(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/§§/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizeForMatch(inputPath: string): string {
  return path.normalize(expandHome(inputPath)).replace(/\\/g, "/");
}

export class PolicyEngine {
  private blockedRead: RegExp[];
  private blockedWrite: RegExp[];

  constructor(private config: ShieldConfig, private workspace: string) {
    this.blockedRead = config.paths.blockedReadGlobs.map(globToRegExp);
    this.blockedWrite = config.paths.blockedWriteGlobs.map(globToRegExp);
  }

  isInsideWorkspace(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    const workspace = path.resolve(this.workspace);
    const rel = path.relative(workspace, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  }

  checkRead(targetPath: string, log: InterceptLog): boolean {
    const normalized = normalizeForMatch(targetPath);
    for (const pattern of this.blockedRead) {
      if (pattern.test(normalized)) {
        log.emit({ kind: "read", target: targetPath, action: "blocked", detail: "policy" });
        return false;
      }
    }
    if (!this.isInsideWorkspace(targetPath)) {
      log.emit({
        kind: "read",
        target: targetPath,
        action: "blocked",
        detail: "outside workspace",
      });
      return false;
    }
    log.emit({ kind: "read", target: targetPath, action: "allowed" });
    return true;
  }

  checkWrite(targetPath: string, log: InterceptLog): boolean {
    const normalized = normalizeForMatch(targetPath);
    for (const pattern of this.blockedWrite) {
      if (pattern.test(normalized)) {
        log.emit({ kind: "write", target: targetPath, action: "blocked", detail: "policy" });
        return false;
      }
    }
    if (!this.isInsideWorkspace(targetPath)) {
      log.emit({
        kind: "write",
        target: targetPath,
        action: "blocked",
        detail: "outside workspace",
      });
      return false;
    }
    log.emit({ kind: "write", target: targetPath, action: "allowed" });
    return true;
  }

  checkNetwork(host: string, log: InterceptLog): boolean {
    if (this.config.sandbox.allowNetwork) {
      if (
        this.config.sandbox.allowedDomains.length > 0 &&
        !this.config.sandbox.allowedDomains.some((d) => host.endsWith(d))
      ) {
        log.emit({ kind: "network", target: host, action: "blocked", detail: "not whitelisted" });
        return false;
      }
      log.emit({ kind: "network", target: host, action: "allowed" });
      return true;
    }
    log.emit({ kind: "network", target: host, action: "blocked", detail: "network disabled" });
    return false;
  }

  scanCommand(command: string, log: InterceptLog): boolean {
    const risky = [
      /\brm\s+-rf\s+\//i,
      /\bformat\s+[a-z]:/i,
      /\bdel\s+\/f\s+\/s\s+\/q\s+[a-z]:\\/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
    ];
    for (const pattern of risky) {
      if (pattern.test(command)) {
        log.emit({ kind: "exec", target: command, action: "blocked", detail: "high-risk pattern" });
        return false;
      }
    }

    const pathTokens = command.match(/(?:~\/|[a-z]:\\|\/)[^\s'"]+/gi) ?? [];
    for (const token of pathTokens) {
      if (!this.checkRead(token, log)) return false;
    }

    log.emit({ kind: "exec", target: command, action: "allowed" });
    return true;
  }

  buildSandboxEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...baseEnv };
    env.SHIELDEDSHELL = "1";
    env.SHIELDEDSHELL_WORKSPACE = this.workspace;
    if (!this.config.sandbox.allowNetwork) {
      env.HTTP_PROXY = "http://127.0.0.1:9";
      env.HTTPS_PROXY = "http://127.0.0.1:9";
      env.NO_PROXY = "localhost,127.0.0.1";
    }
    const stripPrefixes = ["AWS_", "OPENAI_", "ANTHROPIC_", "GITHUB_TOKEN", "NPM_TOKEN"];
    for (const key of Object.keys(env)) {
      if (stripPrefixes.some((prefix) => key.startsWith(prefix))) {
        delete env[key];
      }
    }
    return env;
  }

  preflightPaths(log: InterceptLog): void {
    for (const glob of this.config.paths.blockedReadGlobs) {
      const probe = expandHome(glob.replace(/\*\*/g, "").replace(/\*/g, ""));
      if (probe && fs.existsSync(probe)) {
        this.checkRead(probe, log);
      }
    }
  }
}
