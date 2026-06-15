import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { benchmarkDir } from "./benchmark-gate.js";
import { analyzeLedgerSafety } from "./solvers/interval.js";
import { evaluateApiGatewayPolicy } from "./solvers/datalog.js";

export interface StaticVerifyResult {
  ok: boolean;
  error?: string;
  verifiedByRust?: boolean;
  poisonDetected?: boolean;
}

function findRustSolverBinary(workspace: string): string | null {
  const base = path.join(workspace, "bounded-solvers-rs", "target", "release");
  const names =
    process.platform === "win32"
      ? ["bounded-solvers-rs.exe"]
      : ["bounded-solvers-rs"];
  for (const name of names) {
    const candidate = path.join(base, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function parseBracedBlocks(text: string): string[] {
  const results: string[] = [];
  let start: number | null = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start !== null) {
        results.push(text.slice(start, i + 1));
        start = null;
      }
    }
  }
  return results;
}

function parseBracketBlock(text: string): string | null {
  const match = /\[[\s\S]*?\]/.exec(text);
  return match?.[0] ?? null;
}

function verifyLedgerBenchmark(
  workspace: string,
  benchmarkName: string,
): StaticVerifyResult {
  const auditorPath = path.join(benchmarkDir(workspace, benchmarkName), "auditor_secret.txt");
  const developerPath = path.join(benchmarkDir(workspace, benchmarkName), "developer_secret.txt");
  if (!fs.existsSync(auditorPath) || !fs.existsSync(developerPath)) {
    return { ok: true };
  }

  const auditorText = fs.readFileSync(auditorPath, "utf8");
  const developerText = fs.readFileSync(developerPath, "utf8");
  const braceMatches = parseBracedBlocks(auditorText);
  const bracketMatch = parseBracketBlock(developerText);
  if (braceMatches.length < 1 || !bracketMatch) {
    return { ok: false, error: "Could not parse ledger benchmark secrets" };
  }

  const startingBalances = JSON.parse(braceMatches[0]) as Record<
    string,
    number | [number, number]
  >;
  const transfers = JSON.parse(bracketMatch) as Parameters<typeof analyzeLedgerSafety>[1];
  const analysis = analyzeLedgerSafety(startingBalances, transfers);

  if (!analysis.safe) {
    if (benchmarkName === "06_poison_task") {
      return { ok: true, poisonDetected: true };
    }
    return {
      ok: false,
      error: `Static ledger check failed: account ${analysis.violatingAccount} goes negative to ${analysis.violatingBalance} at step ${analysis.violatingStep}`,
    };
  }

  return { ok: true };
}

function verifyRoutingBenchmark(workspace: string, benchmarkName: string): StaticVerifyResult {
  const auditorPath = path.join(benchmarkDir(workspace, benchmarkName), "auditor_secret.txt");
  const developerPath = path.join(benchmarkDir(workspace, benchmarkName), "developer_secret.txt");
  if (!fs.existsSync(auditorPath) || !fs.existsSync(developerPath)) {
    return { ok: true };
  }

  const auditorBlocks = parseBracedBlocks(fs.readFileSync(auditorPath, "utf8"));
  const developerBlocks = parseBracedBlocks(fs.readFileSync(developerPath, "utf8"));
  if (auditorBlocks.length < 1 || developerBlocks.length < 1) {
    return { ok: false, error: "Could not parse routing benchmark secrets" };
  }

  const policies = JSON.parse(auditorBlocks[0]) as Record<string, string>;
  const routes = JSON.parse(developerBlocks[0]) as Record<string, string>;
  const result = evaluateApiGatewayPolicy(policies, routes);
  if (!result.safe) {
    return {
      ok: false,
      error: `Static routing check failed: sensitive route "${result.violations[0]}" inherits public access`,
    };
  }
  return { ok: true };
}

export function runBenchmarkStaticVerification(
  workspace: string,
  benchmarkName: string,
): StaticVerifyResult {
  const rustBinary = findRustSolverBinary(workspace);
  if (rustBinary) {
    const auditorPath = path.join(benchmarkDir(workspace, benchmarkName), "auditor_secret.txt");
    const developerPath = path.join(benchmarkDir(workspace, benchmarkName), "developer_secret.txt");
    if (fs.existsSync(auditorPath) && fs.existsSync(developerPath)) {
      const result = spawnSync(
        rustBinary,
        [
          "verify",
          "--benchmark",
          benchmarkName,
          "--auditor-secret",
          auditorPath,
          "--developer-secret",
          developerPath,
        ],
        { encoding: "utf8" },
      );
      if (result.status === 0) {
        return { ok: true, verifiedByRust: true };
      }
      const stderr = result.stderr?.trim();
      if (benchmarkName === "06_poison_task" && result.status === 2) {
        return { ok: true, verifiedByRust: true, poisonDetected: true };
      }
      return {
        ok: false,
        verifiedByRust: true,
        error: stderr || `Rust static verification failed with exit ${result.status}`,
      };
    }
  }

  if (benchmarkName === "02_ledger_consensus" || benchmarkName === "06_poison_task") {
    return verifyLedgerBenchmark(workspace, benchmarkName);
  }
  if (benchmarkName === "04_api_gateway") {
    return verifyRoutingBenchmark(workspace, benchmarkName);
  }

  return { ok: true };
}
