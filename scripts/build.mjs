import { execSync } from "node:child_process";

function run(command) {
  execSync(command, { stdio: "inherit", shell: true });
}

if (process.env.CF_PAGES === "1") {
  run("npm run build -w website");
} else {
  run("npm run build -w @shieldedshell/core && npm run build -w @shieldedshell/cli");
}
