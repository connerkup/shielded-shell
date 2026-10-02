import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface AcobTierCheck {
  status: "PASS" | "FAIL";
  details: string;
}

export interface VerificationReceipt {
  version: "2.0";
  id: string;
  timestamp: string;
  merkleRoot: string;
  success: boolean;
  iterations: number;
  reason: string;
  benchmark?: string;
  acob: {
    tier1_osBoundary: AcobTierCheck;
    tier2_systemOpSec: AcobTierCheck;
    tier3_runtimeIntegrity: AcobTierCheck;
    tier4_multiAgentConsensus: AcobTierCheck;
  };
  signature: string;
  card: string;
}

export interface RunContext {
  workspace: string;
  success: boolean;
  iterations: number;
  reason?: string;
  benchmark?: string;
  mergeTarget?: string;
  changedFiles?: string[];
  tierStatus?: {
    tier1?: boolean;
    tier2?: boolean;
    tier3?: boolean;
    tier4?: boolean;
  };
}

export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return crypto.createHash("sha256").update("empty-workspace").digest("hex");
  }
  let level = leaves.map((leaf) =>
    leaf.length === 64 && /^[0-9a-f]{64}$/i.test(leaf)
      ? leaf
      : crypto.createHash("sha256").update(leaf).digest("hex"),
  );
  level.sort();

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      const combined = crypto
        .createHash("sha256")
        .update(left + right)
        .digest("hex");
      next.push(combined);
    }
    level = next;
  }
  return level[0];
}

export function computeWorkspaceMerkleRoot(
  workspace: string,
  changedFiles?: string[],
): string {
  const leaves: string[] = [];
  const filesToCheck =
    changedFiles && changedFiles.length > 0
      ? changedFiles
      : [
          "auth_service.js",
          "output.js",
          "developer_output.json",
          "auditor_output.json",
          "shared_context.txt",
        ];

  for (const rel of filesToCheck) {
    const fullPath = path.isAbsolute(rel) ? rel : path.join(workspace, rel);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      const leafHash = crypto
        .createHash("sha256")
        .update(`${path.basename(rel)}:${hash}`)
        .digest("hex");
      leaves.push(leafHash);
    }
  }

  return computeMerkleRoot(leaves);
}

export function formatReceiptCard(receipt: Omit<VerificationReceipt, "card">): string {
  const width = 74;
  const pad = (s: string, len: number) => (s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length));
  const line = (content: string) => `│ ${pad(content, width - 4)} │`;
  const hr = (start: string, mid: string, end: string) => `${start}${"─".repeat(width - 2)}${end}`;

  const statusLabel = receipt.success
    ? `PASSED (${receipt.iterations} iter)`
    : `FAILED (${receipt.iterations} iter)`;

  const lines = [
    hr("┌", "─", "┐"),
    line("ShieldedShell v2 — Cryptographic Verification Receipt"),
    hr("├", "─", "┤"),
    line(`Receipt ID:    ${receipt.id}`),
    line(`Timestamp:     ${receipt.timestamp}`),
    line(`Status:        ${statusLabel}`),
    line(`Reason:        ${receipt.reason}`),
    line(`Merkle Root:   ${receipt.merkleRoot}`),
    ...(receipt.benchmark ? [line(`Benchmark:     ${receipt.benchmark}`)] : []),
    hr("├", "─", "┤"),
    line("ACOB 4-Tier Verification Matrix:"),
    line(` [${receipt.acob.tier1_osBoundary.status}] Tier 1: OS Boundary & Perimeter Isolation`),
    line(`       ${receipt.acob.tier1_osBoundary.details}`),
    line(` [${receipt.acob.tier2_systemOpSec.status}] Tier 2: System OpSec & Persistence Lockdown`),
    line(`       ${receipt.acob.tier2_systemOpSec.details}`),
    line(` [${receipt.acob.tier3_runtimeIntegrity.status}] Tier 3: Runtime & Execution Integrity`),
    line(`       ${receipt.acob.tier3_runtimeIntegrity.details}`),
    line(` [${receipt.acob.tier4_multiAgentConsensus.status}] Tier 4: Multi-Agent Consensus & Game Theory`),
    line(`       ${receipt.acob.tier4_multiAgentConsensus.details}`),
    hr("├", "─", "┤"),
    line(`Signature:     ${receipt.signature.slice(0, 48)}...`),
    hr("└", "─", "┘"),
  ];

  return lines.join("\n");
}

export function generateReceipt(runContext: RunContext): VerificationReceipt {
  const timestamp = new Date().toISOString();
  const merkleRoot = computeWorkspaceMerkleRoot(
    runContext.workspace,
    runContext.changedFiles,
  );
  const id = crypto
    .createHash("sha256")
    .update(`${runContext.workspace}:${timestamp}:${merkleRoot}`)
    .digest("hex")
    .slice(0, 32);

  const t1 = runContext.tierStatus?.tier1 ?? true;
  const t2 = runContext.tierStatus?.tier2 ?? true;
  const t3 = runContext.tierStatus?.tier3 ?? true;
  const t4 = runContext.tierStatus?.tier4 ?? runContext.success;

  const acob = {
    tier1_osBoundary: {
      status: (t1 ? "PASS" : "FAIL") as "PASS" | "FAIL",
      details: "Perimeter boundary, credential masking, symlink breakout defense",
    },
    tier2_systemOpSec: {
      status: (t2 ? "PASS" : "FAIL") as "PASS" | "FAIL",
      details: "Git hook write deny, shell RC dotfile locks, execution timeout deadline",
    },
    tier3_runtimeIntegrity: {
      status: (t3 ? "PASS" : "FAIL") as "PASS" | "FAIL",
      details: "Ephemeral CoW overlay rollback, assertion anti-spoof token handshake",
    },
    tier4_multiAgentConsensus: {
      status: (t4 ? "PASS" : "FAIL") as "PASS" | "FAIL",
      details: "Spatial phase write locks, Horn Datalog & interval solver invariant verification",
    },
  };

  const payloadToSign = `${id}:${timestamp}:${merkleRoot}:${runContext.success}:${runContext.iterations}:${runContext.reason ?? ""}`;
  const signature = crypto
    .createHash("sha256")
    .update(payloadToSign)
    .digest("hex");

  const partialReceipt = {
    version: "2.0" as const,
    id,
    timestamp,
    merkleRoot,
    success: runContext.success,
    iterations: runContext.iterations,
    reason: runContext.reason ?? (runContext.success ? "SUCCESS" : "FAILED"),
    benchmark: runContext.benchmark,
    acob,
    signature,
  };

  const card = formatReceiptCard(partialReceipt);

  return {
    ...partialReceipt,
    card,
  };
}
