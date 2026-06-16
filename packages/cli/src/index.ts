#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import {
  analyzeLedgerSafety,
  engineBinaryName,
  evaluateApiGatewayPolicy,
  findConfigPath,
  initLoopWorkspace,
  loadConfig,
  orchestrateDualAgentLoop,
  parseAgentEngine,
  reconcile,
  runAgentLoop,
  runCommand,
  spawnInteractiveShell,
  SUPPORTED_ENGINES,
  writeDefaultConfig,
} from "@shieldedshell/core";
import { spawnSync } from "node:child_process";

const program = new Command();

program
  .name("shieldedshell")
  .description("Zero-trust local safety harness for CLI coding agents")
  .version("0.1.0");

program
  .command("init")
  .description("Create a default shield.yaml in the current directory")
  .option("-f, --force", "Overwrite existing shield.yaml")
  .action((opts: { force?: boolean }) => {
    const target = path.join(process.cwd(), "shield.yaml");
    if (fs.existsSync(target) && !opts.force) {
      console.error("shield.yaml already exists (use --force to overwrite)");
      process.exit(1);
    }
    writeDefaultConfig(target);
    console.log(`Wrote ${target}`);
  });

program
  .command("run")
  .description("Run a command inside a sandboxed workspace (use -- before args with flags)")
  .argument("[command...]", "Command and arguments")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .option("-c, --config <path>", "Path to shield.yaml")
  .option("--no-overlay", "Disable copy-on-write overlay")
  .allowUnknownOption()
  .allowExcessArguments()
  .action(async (commandParts: string[], opts: { dir: string; config?: string; overlay?: boolean }) => {
    const argv = process.argv;
    const runIndex = argv.indexOf("run");
    let command = commandParts;
    if (runIndex >= 0) {
      const dashDash = argv.indexOf("--", runIndex + 1);
      if (dashDash >= 0) {
        command = argv.slice(dashDash + 1);
      }
    }
    if (command.length === 0) {
      console.error("Usage: shieldedshell run [--] <command...>");
      process.exit(1);
    }
    const config = loadConfig(opts.config, opts.dir);
    const result = await runCommand(command[0], command.slice(1), {
      cwd: opts.dir,
      config,
      configPath: opts.config,
      useOverlay: opts.overlay !== false,
    });
    process.exit(result.exitCode ?? 1);
  });

program
  .command("shell")
  .description("Start an interactive shell bound to the workspace")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .option("-c, --config <path>", "Path to shield.yaml")
  .action(async (opts: { dir: string; config?: string }) => {
    const config = loadConfig(opts.config, opts.dir);
    const result = await spawnInteractiveShell({
      cwd: opts.dir,
      config,
      configPath: opts.config,
    });
    process.exit(result.exitCode ?? 0);
  });

program
  .command("verify")
  .description("Run static safety solvers")
  .requiredOption("-t, --type <kind>", "ledger or routing")
  .option("--balances <json>", "Starting balances JSON")
  .option("--transfers <json>", "Transfers JSON array")
  .option("--policies <json>", "Route policies JSON")
  .option("--routes <json>", "Route map JSON")
  .option("--file-balances <path>", "Balances JSON file")
  .option("--file-transfers <path>", "Transfers JSON file")
  .option("--file-policies <path>", "Policies JSON file")
  .option("--file-routes <path>", "Routes JSON file")
  .action((opts) => {
    if (opts.type === "ledger") {
      const balances = readJsonObject(opts.balances, opts.fileBalances) as Record<
        string,
        number | [number, number]
      >;
      const transfers = readJsonArray(opts.transfers, opts.fileTransfers) as Parameters<
        typeof analyzeLedgerSafety
      >[1];
      const audit = analyzeLedgerSafety(balances, transfers);
      if (!audit.safe) {
        console.error(
          `UNSAFE: account ${audit.violatingAccount} at step ${audit.violatingStep} (${audit.violatingBalance})`,
        );
        process.exit(2);
      }
      console.log("SAFE: ledger invariants hold");
      return;
    }

    if (opts.type === "routing") {
      const policies = readJsonObject(opts.policies, opts.filePolicies) as Record<string, string>;
      const routes = readJsonObject(opts.routes, opts.fileRoutes) as Record<string, string>;
      const result = evaluateApiGatewayPolicy(policies, routes);
      if (!result.safe) {
        console.error(`UNSAFE: routing violations ${result.violations.join(", ")}`);
        process.exit(3);
      }
      console.log("SAFE: routing policies hold");
      return;
    }

    console.error("Unknown verify type. Use ledger or routing.");
    process.exit(1);
  });

program
  .command("orchestrate")
  .description("Run dual-agent developer/architect consensus loop")
  .requiredOption("--dev <command>", "Developer agent command")
  .requiredOption("--audit <command>", "Auditor agent command")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .option("-c, --config <path>", "Path to shield.yaml")
  .option("--benchmark <name>", "Optional benchmark folder name")
  .option("--target <path>", "Merge target file", "auth_service.js")
  .action(async (opts) => {
    const config = loadConfig(opts.config, opts.dir);
    const result = await orchestrateDualAgentLoop({
      workspace: opts.dir,
      config,
      devCommand: opts.dev,
      auditCommand: opts.audit,
      benchmark: opts.benchmark,
      mergeTarget: path.resolve(opts.dir, opts.target),
    });
    if (!result.success) {
      console.error(`Orchestration failed: ${result.reason}`);
      process.exit(1);
    }
    console.log(`Orchestration succeeded in ${result.iterations} iteration(s)`);
  });

program
  .command("reconcile")
  .description("Run the reconciler gate on current developer/auditor buffers")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .option("-c, --config <path>", "Path to shield.yaml")
  .option("--benchmark <name>", "Optional benchmark folder name")
  .option("--target <path>", "Merge target file", "auth_service.js")
  .action((opts) => {
    const config = loadConfig(opts.config, opts.dir);
    const workspace = path.resolve(opts.dir);
    const mergeTarget = path.resolve(workspace, opts.target);
    const result = reconcile({
      workspace,
      config,
      benchmark: opts.benchmark,
      overlayMerge: false,
      paths: {
        developerOutput: path.join(workspace, "developer_output.json"),
        auditorOutput: path.join(workspace, "auditor_output.json"),
        sharedContext: path.join(workspace, "shared_context.txt"),
        mergeTarget,
        hashHistory: path.join(workspace, ".shieldedshell", "state", "hash_history.json"),
      },
    });
    if (!result.success) {
      console.error(`Reconcile failed: ${result.reason}`);
      process.exit(1);
    }
    console.log(`Reconcile succeeded: ${result.reason}`);
  });

program
  .command("loop")
  .description("Run dual-agent loop with engine dispatch and prompt templates")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .option("-c, --config <path>", "Path to shield.yaml")
  .requiredOption(
    "-e, --engine <name>",
    "Agent engine: claude, cline, aider, openhands, openhands-sdk, opencode, antigravity, copilot, cursor, openclaw",
  )
  .option("--benchmark <name>", "Benchmark folder under ./benchmark")
  .option("--target <path>", "Merge target file", "auth_service.js")
  .action(async (opts) => {
    const config = loadConfig(opts.config, opts.dir);
    const workspace = path.resolve(opts.dir);
    let engine;
    try {
      engine = parseAgentEngine(opts.engine);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    initLoopWorkspace(workspace);
    const result = await runAgentLoop({
      workspace,
      config,
      engine,
      benchmark: opts.benchmark,
      mergeTarget: path.resolve(workspace, opts.target),
    });
    if (!result.success) {
      console.error(`Loop failed: ${result.reason}`);
      process.exit(1);
    }
    console.log(`Loop succeeded in ${result.iterations} iteration(s)`);
  });

program
  .command("doctor")
  .description("Print environment and config diagnostics")
  .option("-d, --dir <path>", "Workspace directory", process.cwd())
  .action((opts: { dir: string }) => {
    const configPath = findConfigPath(opts.dir);
    console.log(`Node: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Workspace: ${path.resolve(opts.dir)}`);
    console.log(`Config: ${configPath ?? "(defaults only)"}`);
    console.log(`Supported engines: ${SUPPORTED_ENGINES.join(", ")}`);
    for (const engine of SUPPORTED_ENGINES) {
      const binary = engineBinaryName(engine);
      const lookupCmd = process.platform === "win32" ? "where" : "which";
      const lookup = spawnSync(lookupCmd, [binary], { encoding: "utf8" });
      const status = lookup.status === 0 ? "found" : "not on PATH";
      console.log(`  ${engine}: ${binary} (${status})`);
    }
    if (configPath) {
      console.log(JSON.stringify(loadConfig(configPath, opts.dir), null, 2));
    }
  });

program.hook("preAction", () => {
  if (process.argv.length <= 2) {
    program.help();
  }
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

function readJsonObject(inline?: string, filePath?: string): Record<string, unknown> {
  if (filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as Record<string, unknown>;
  }
  if (inline) {
    return JSON.parse(inline) as Record<string, unknown>;
  }
  throw new Error("Missing required JSON input (use inline flag or --file-*)");
}

function readJsonArray(inline?: string, filePath?: string): unknown[] {
  if (filePath) {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")) as unknown[];
  }
  if (inline) {
    return JSON.parse(inline) as unknown[];
  }
  throw new Error("Missing required JSON input (use inline flag or --file-*)");
}
