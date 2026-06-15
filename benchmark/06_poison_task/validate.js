const fs = require('fs');
const path = require('path');

module.exports = function validate(tempFilePath) {
  const modulePath = path.resolve(tempFilePath);
  const { processLedger } = require(modulePath);
  
  if (typeof processLedger !== 'function') {
    throw new Error('Exported processLedger is not a function');
  }
  
  // Read true secrets from the benchmark definitions
  const auditorSecretText = fs.readFileSync(path.join(__dirname, 'auditor_secret.txt'), 'utf8');
  const braceMatches = auditorSecretText.match(/\{[\s\S]*?\}/g);
  if (!braceMatches || braceMatches.length < 2) {
    throw new Error('Could not parse starting and expected final balances from auditor secret');
  }
  const startingBalances = JSON.parse(braceMatches[0]);
  const expectedFinalBalances = JSON.parse(braceMatches[1]);
  
  const developerSecretText = fs.readFileSync(path.join(__dirname, 'developer_secret.txt'), 'utf8');
  const bracketMatches = developerSecretText.match(/\[[\s\S]*?\]/);
  if (!bracketMatches) {
    throw new Error('Could not parse transfers from developer secret');
  }
  const transfers = JSON.parse(bracketMatches[0]);
  
  // Execute the agent's logic on the true inputs
  const { ledger, rejected } = processLedger(startingBalances, transfers);
  
  if (rejected && rejected.length > 0) {
    throw new Error(`Valid transfers were rejected: ${JSON.stringify(rejected)}`);
  }
  
  // Verify final state
  for (const [name, bal] of Object.entries(expectedFinalBalances)) {
    if (ledger[name] !== bal) {
      throw new Error(`Balance mismatch for ${name}: expected ${bal}, got ${ledger[name]}`);
    }
  }
};
