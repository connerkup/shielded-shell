import fs from "node:fs";

export type ConsolidationKind = "audit_rejected" | "regressive_loop" | "generic";

export function consolidateSharedContext(
  sharedContextPath: string,
  feedback: string,
  kind: ConsolidationKind = "generic",
): void {
  if (!fs.existsSync(sharedContextPath)) {
    fs.writeFileSync(
      sharedContextPath,
      "Task: ShieldedShell dual-agent session.\n",
      "utf8",
    );
  }

  let content = fs.readFileSync(sharedContextPath, "utf8");
  const sections = content.split(/\n?(=== \[Reconciler Log\][^\n]*===)\n?/g);
  const filtered = sections.filter((s) => s.trim().length > 0);
  const header = filtered[0]?.trim() ?? "Task: ShieldedShell dual-agent session.";
  const logEntries: string[] = [];

  for (let i = 1; i < filtered.length; i += 2) {
    if (filtered[i] && filtered[i + 1]) {
      logEntries.push(`${filtered[i]}\n${filtered[i + 1].trim()}`);
    } else if (filtered[i]) {
      logEntries.push(filtered[i]);
    }
  }

  const timestamp = new Date().toISOString();
  const titleByKind: Record<ConsolidationKind, string> = {
    audit_rejected: `Turn Failed - Audit Rejected at ${timestamp}`,
    regressive_loop: `Turn Failed - REGRESSIVE_LOOP_DETECTED at ${timestamp}`,
    generic: `Turn Failed at ${timestamp}`,
  };

  logEntries.push(`=== [Reconciler Log] ${titleByKind[kind]} ===\n${feedback}`);

  if (logEntries.length > 2) {
    const consolidatedCount = logEntries.length - 2;
    const activeEntries = logEntries.slice(-2);
    const consolidatedHeader = `=== [Reconciler Log] Consolidated ${consolidatedCount} older failed iterations to save context ===\n- Summary: Historical iterations failed code lint/security checks. Developer addressed older criteria.`;
    content = `${header}\n\n${consolidatedHeader}\n\n${activeEntries.join("\n\n")}\n`;
  } else {
    content = `${header}\n\n${logEntries.join("\n\n")}\n`;
  }

  fs.writeFileSync(sharedContextPath, content, "utf8");
}

export function appendGovernorInterrupt(sharedContextPath: string, maxIterations: number): void {
  const block = `\n\n=== [Governor Log] Loop Terminated - INTERRUPT_REQUIRED ===\nImpasse reached between Developer and Auditor after ${maxIterations} iterations. Manual intervention required.\n`;
  if (fs.existsSync(sharedContextPath)) {
    fs.appendFileSync(sharedContextPath, block, "utf8");
  } else {
    fs.writeFileSync(sharedContextPath, block.trimStart(), "utf8");
  }
}
