import fs from "node:fs";
import path from "node:path";

const LEDGER_CODE = `
function processLedger(startingBalances, transfers) {
  const ledger = { ...startingBalances };
  const rejected = [];
  for (const tx of transfers) {
    if (ledger[tx.from] < tx.amount) {
      rejected.push(tx);
      continue;
    }
    ledger[tx.from] -= tx.amount;
    ledger[tx.to] += tx.amount;
  }
  return { ledger, rejected };
}
module.exports = { processLedger };
`.trim();

const developerPayload = {
  code: LEDGER_CODE,
  explanation: "Correct ledger consensus implementation (fixture agent).",
  query_for_auditor: null,
};

const auditorPayload = {
  status: "PASSED",
  kill_criteria: [],
  feedback_for_developer: "Fixture auditor approves ledger implementation.",
};

const target = process.argv[2];
if (!target) {
  console.error("Usage: mock-dev-ledger.mjs <developer_output.json>");
  process.exit(1);
}

fs.writeFileSync(path.resolve(target), `${JSON.stringify(developerPayload, null, 2)}\n`, "utf8");
