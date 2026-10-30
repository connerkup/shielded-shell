## 2024-10-30 - Command Injection in Syntax Checker
**Vulnerability:** Use of string-based \`execSync\` for node syntax checking (\`execSync(\\\`node --check "\${tempFile}"\\\`)\`) allows for potential command injection if \`tempFile\` path can be manipulated.
**Learning:** Even internal tool execution or paths that seem controlled should use array-based argument passing (e.g., \`spawnSync\`) and \`process.execPath\` to absolutely prevent injection vulnerabilities in execution engines.
**Prevention:** Always prefer \`spawnSync\` over \`execSync\`, use \`process.execPath\` for invoking node, and pass arguments as an array rather than constructing a command string.
