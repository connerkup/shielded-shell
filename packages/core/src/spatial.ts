import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type LoopPhase = "developer" | "auditor" | "reconcile";

export interface PartitionTargets {
  developerOutput: string;
  auditorOutput: string;
  sharedContext: string;
  mergeTarget: string;
}

function ensureFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "", "utf8");
  }
}

export function setWriteAccess(filePath: string, writable: boolean): void {
  if (!fs.existsSync(filePath)) return;

  if (process.platform === "win32") {
    spawnSync("attrib", [writable ? "-R" : "+R", filePath], {
      shell: true,
      stdio: "ignore",
    });
    return;
  }

  try {
    const stat = fs.statSync(filePath);
    const mode = stat.mode & 0o777;
    const next = writable ? mode | 0o200 : mode & ~0o222;
    fs.chmodSync(filePath, next);
  } catch {
    fs.chmodSync(filePath, writable ? 0o666 : 0o444);
  }
}

export function restoreAllWritable(targets: PartitionTargets): void {
  for (const filePath of Object.values(targets)) {
    ensureFile(filePath);
    setWriteAccess(filePath, true);
  }
}

export function applyPhaseLocks(phase: LoopPhase, targets: PartitionTargets): void {
  for (const filePath of Object.values(targets)) {
    ensureFile(filePath);
  }

  restoreAllWritable(targets);

  switch (phase) {
    case "developer":
      setWriteAccess(targets.developerOutput, true);
      setWriteAccess(targets.sharedContext, false);
      setWriteAccess(targets.auditorOutput, false);
      setWriteAccess(targets.mergeTarget, false);
      break;
    case "auditor":
      setWriteAccess(targets.auditorOutput, true);
      setWriteAccess(targets.sharedContext, false);
      setWriteAccess(targets.developerOutput, false);
      setWriteAccess(targets.mergeTarget, false);
      break;
    case "reconcile":
      setWriteAccess(targets.sharedContext, true);
      setWriteAccess(targets.mergeTarget, true);
      setWriteAccess(targets.developerOutput, false);
      setWriteAccess(targets.auditorOutput, false);
      break;
  }
}
