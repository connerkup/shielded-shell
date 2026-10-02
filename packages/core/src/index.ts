export { loadConfig, defaultConfig, writeDefaultConfig, findConfigPath, resolveWorkspace } from "./config.js";
export type { ShieldConfig } from "./config.js";

export { InterceptLog } from "./intercept.js";
export type { InterceptEvent, InterceptKind } from "./intercept.js";

export {
  ensureOverlay,
  mergeOverlay,
  listOverlayChanges,
  resetOverlay,
  overlayPaths,
  createEphemeralOverlay,
  withEphemeralOverlay,
} from "./overlay.js";
export type { EphemeralOverlay, OverlayPaths } from "./overlay.js";

export {
  PolicyEngine,
  DEFAULT_BLOCKED_PATHS,
  DEFAULT_BLOCKED_WRITE_PATHS,
  MANDATORY_BLOCKED_WRITE_GLOBS,
} from "./policy.js";

export { Interval, analyzeLedgerSafety } from "./solvers/interval.js";
export type { Transfer, LedgerSafetyResult } from "./solvers/interval.js";

export { DatalogEvaluator, evaluateApiGatewayPolicy } from "./solvers/datalog.js";
export type { Literal, Rule } from "./solvers/datalog.js";

export {
  SecureSandbox,
  runSandboxedNodeScript,
  runSandboxedNodeScriptAsync,
  runSecureValidator,
  generateAntiSpoofToken,
  verifyAntiSpoofToken,
  DEFAULT_CPU_TIMEOUT_MS,
  DEFAULT_KILL_GRACE_PERIOD_MS,
} from "./sandbox.js";
export type { SandboxRunResult, SandboxRunOptions } from "./sandbox.js";

export {
  runCommand,
  runCommandSync,
  spawnInteractiveShell,
  auditStaticFromFiles,
} from "./runner.js";
export type { RunCommandOptions, RunCommandResult } from "./runner.js";

export { reconcile } from "./reconcile.js";
export type { ReconcileOptions, ReconcileResult, ReconcilePaths } from "./reconcile.js";

export { orchestrateDualAgentLoop } from "./orchestrator.js";
export type { OrchestrateOptions, OrchestrateResult } from "./orchestrator.js";

export {
  generateReceipt,
  formatReceiptCard,
  computeMerkleRoot,
  computeWorkspaceMerkleRoot,
} from "./receipt.js";
export type { VerificationReceipt, RunContext, AcobTierCheck } from "./receipt.js";

export { runAcobBenchmark, formatAcobScorecard } from "./acob.js";
export type { AcobBenchmarkResult, AcobCheckResult } from "./acob.js";

export { applyPhaseLocks, restoreAllWritable, setWriteAccess } from "./spatial.js";
export type { LoopPhase, PartitionTargets } from "./spatial.js";

export {
  exposeDeveloperSecret,
  exposeAuditorSecret,
  hideBenchmarkSecrets,
  validatorPath,
  benchmarkDir,
} from "./benchmark-gate.js";

export { consolidateSharedContext, appendGovernorInterrupt } from "./context.js";
export type { ConsolidationKind } from "./context.js";

export { runBenchmarkStaticVerification } from "./static-verify.js";
export type { StaticVerifyResult } from "./static-verify.js";

export {
  buildEngineCommand,
  buildLoopCommands,
  checkEngineHealth,
  engineBinaryName,
  engineProfile,
  ENGINE_PROFILES,
  packageRoot,
  parseAgentEngine,
  resolvePromptPaths,
  SUPPORTED_ENGINES,
} from "./engines.js";
export type {
  AgentEngine,
  EngineCommandOptions,
  EngineHealth,
  EngineProfile,
  PromptPaths,
} from "./engines.js";
export { DEFAULT_AGENT_TIMEOUT_MS, LOOP_TOOL_HINT } from "./engine-profiles.js";

export { runAgentLoop, initLoopWorkspace } from "./loop.js";
export type { LoopOptions } from "./loop.js";
