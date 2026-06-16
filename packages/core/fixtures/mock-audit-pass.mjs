import fs from "node:fs";
import path from "node:path";

const auditorPayload = {
  status: "PASSED",
  kill_criteria: [],
  feedback_for_developer: "Fixture auditor pass.",
};

const target = process.argv[2];
if (!target) {
  console.error("Usage: mock-audit-pass.mjs <auditor_output.json>");
  process.exit(1);
}

fs.writeFileSync(path.resolve(target), `${JSON.stringify(auditorPayload, null, 2)}\n`, "utf8");
