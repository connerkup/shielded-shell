import fs from "node:fs";
import path from "node:path";

const DEV_ACCESS = "secret_developer_access.txt";
const AUD_ACCESS = "secret_auditor_access.txt";

export function benchmarkDir(workspace: string, benchmarkName: string): string {
  return path.join(workspace, "benchmark", benchmarkName);
}

export function hideBenchmarkSecrets(workspace: string): void {
  const root = path.join(workspace, "benchmark");
  for (const name of [DEV_ACCESS, AUD_ACCESS]) {
    const target = path.join(root, name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}

export function exposeDeveloperSecret(workspace: string, benchmarkName: string): void {
  hideBenchmarkSecrets(workspace);
  const src = path.join(benchmarkDir(workspace, benchmarkName), "developer_secret.txt");
  const dest = path.join(workspace, "benchmark", DEV_ACCESS);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export function exposeAuditorSecret(workspace: string, benchmarkName: string): void {
  hideBenchmarkSecrets(workspace);
  const src = path.join(benchmarkDir(workspace, benchmarkName), "auditor_secret.txt");
  const dest = path.join(workspace, "benchmark", AUD_ACCESS);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

export function validatorPath(workspace: string, benchmarkName: string): string {
  return path.join(benchmarkDir(workspace, benchmarkName), "validate.js");
}
