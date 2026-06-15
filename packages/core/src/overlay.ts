import fs from "node:fs";
import path from "node:path";
import type { InterceptLog } from "./intercept.js";

const OVERLAY_DIR = ".shieldedshell";
const OVERLAY_SUBDIR = "overlay";

export interface OverlayPaths {
  root: string;
  overlay: string;
  auditLogs: string;
  stateDir: string;
}

export function overlayPaths(workspace: string): OverlayPaths {
  const root = path.join(workspace, OVERLAY_DIR);
  return {
    root,
    overlay: path.join(root, OVERLAY_SUBDIR),
    auditLogs: path.join(root, "audit_logs"),
    stateDir: path.join(root, "state"),
  };
}

function shouldSkip(name: string): boolean {
  return name === OVERLAY_DIR || name === "node_modules" || name === ".git";
}

function copyRecursive(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (shouldSkip(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function ensureOverlay(workspace: string, log: InterceptLog): OverlayPaths {
  const paths = overlayPaths(workspace);
  fs.mkdirSync(paths.overlay, { recursive: true });
  fs.mkdirSync(paths.auditLogs, { recursive: true });
  fs.mkdirSync(paths.stateDir, { recursive: true });

  for (const entry of fs.readdirSync(workspace)) {
    if (shouldSkip(entry)) continue;
    const src = path.join(workspace, entry);
    const dest = path.join(paths.overlay, entry);
    if (!fs.existsSync(dest)) {
      copyRecursive(src, dest);
    }
  }

  log.info(`CoW overlay ready at ${paths.overlay}`);
  return paths;
}

export function listOverlayChanges(workspace: string): string[] {
  const { overlay } = overlayPaths(workspace);
  if (!fs.existsSync(overlay)) return [];

  const changed: string[] = [];
  function walk(rel: string, base: string, mirror: string): void {
    if (!fs.existsSync(mirror)) return;
    const stat = fs.statSync(mirror);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(mirror)) {
        walk(path.join(rel, entry), base, path.join(mirror, entry));
      }
      return;
    }
    const original = path.join(base, rel);
    if (!fs.existsSync(original)) {
      changed.push(rel);
      return;
    }
    const a = fs.readFileSync(original);
    const b = fs.readFileSync(mirror);
    if (!a.equals(b)) changed.push(rel);
  }

  walk("", workspace, overlay);
  return changed;
}

export function mergeOverlay(workspace: string, log: InterceptLog): number {
  const { overlay } = overlayPaths(workspace);
  if (!fs.existsSync(overlay)) return 0;

  let merged = 0;
  function walk(rel: string): void {
    const mirrorPath = path.join(overlay, rel);
    const stat = fs.statSync(mirrorPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(mirrorPath)) {
        walk(path.join(rel, entry));
      }
      return;
    }
    const target = path.join(workspace, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(mirrorPath, target);
    merged += 1;
    log.emit({
      kind: "write",
      target: rel,
      action: "allowed",
      detail: "merged from overlay",
    });
  }

  for (const entry of fs.readdirSync(overlay)) {
    walk(entry);
  }
  log.audit(`Merged ${merged} overlay file(s) to workspace`);
  return merged;
}

export function resetOverlay(workspace: string): void {
  const { root } = overlayPaths(workspace);
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
