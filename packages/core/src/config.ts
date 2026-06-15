import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface ShieldConfig {
  version: string;
  sandbox: {
    workspaceDir: string;
    allowNetwork: boolean;
    allowedDomains: string[];
    maxMemoryMb: number;
    cpuTimeoutMs: number;
    overlayEnabled: boolean;
  };
  invariants: {
    ledger: { enabled: boolean; minBalance: number };
    routing: { enabled: boolean; allowSensitivePublic: boolean };
  };
  autoHeal: {
    maxRetryCycles: number;
    model: string;
  };
  paths: {
    blockedReadGlobs: string[];
    blockedWriteGlobs: string[];
  };
}

const DEFAULT_CONFIG: ShieldConfig = {
  version: "1.0",
  sandbox: {
    workspaceDir: ".",
    allowNetwork: false,
    allowedDomains: [],
    maxMemoryMb: 256,
    cpuTimeoutMs: 300_000,
    overlayEnabled: true,
  },
  invariants: {
    ledger: { enabled: false, minBalance: 0 },
    routing: { enabled: false, allowSensitivePublic: false },
  },
  autoHeal: {
    maxRetryCycles: 5,
    model: "claude-3-5-sonnet",
  },
  paths: {
    blockedReadGlobs: [
      "~/.ssh/**",
      "~/.aws/**",
      "**/.env",
      "**/.env.*",
      "**/id_rsa",
      "**/credentials.json",
    ],
    blockedWriteGlobs: ["**/.git/**", "**/node_modules/**"],
  },
};

function normalizeConfig(raw: Record<string, unknown>): ShieldConfig {
  const sandbox = (raw.sandbox as Record<string, unknown>) ?? {};
  const invariants = (raw.invariants as Record<string, unknown>) ?? {};
  const ledger = (invariants.ledger as Record<string, unknown>) ?? {};
  const routing = (invariants.routing as Record<string, unknown>) ?? {};
  const autoHeal = (raw.auto_heal as Record<string, unknown>) ?? {};
  const paths = (raw.paths as Record<string, unknown>) ?? {};

  return {
    version: String(raw.version ?? DEFAULT_CONFIG.version),
    sandbox: {
      workspaceDir: String(sandbox.workspace_dir ?? DEFAULT_CONFIG.sandbox.workspaceDir),
      allowNetwork: Boolean(sandbox.allow_network ?? DEFAULT_CONFIG.sandbox.allowNetwork),
      allowedDomains: Array.isArray(sandbox.allowed_domains)
        ? sandbox.allowed_domains.map(String)
        : DEFAULT_CONFIG.sandbox.allowedDomains,
      maxMemoryMb: Number(sandbox.max_memory_mb ?? DEFAULT_CONFIG.sandbox.maxMemoryMb),
      cpuTimeoutMs: Number(sandbox.cpu_timeout_ms ?? DEFAULT_CONFIG.sandbox.cpuTimeoutMs),
      overlayEnabled: Boolean(sandbox.overlay_enabled ?? DEFAULT_CONFIG.sandbox.overlayEnabled),
    },
    invariants: {
      ledger: {
        enabled: Boolean(ledger.enabled ?? DEFAULT_CONFIG.invariants.ledger.enabled),
        minBalance: Number(ledger.min_balance ?? DEFAULT_CONFIG.invariants.ledger.minBalance),
      },
      routing: {
        enabled: Boolean(routing.enabled ?? DEFAULT_CONFIG.invariants.routing.enabled),
        allowSensitivePublic: Boolean(
          routing.allow_sensitive_public ?? DEFAULT_CONFIG.invariants.routing.allowSensitivePublic,
        ),
      },
    },
    autoHeal: {
      maxRetryCycles: Number(autoHeal.max_retry_cycles ?? DEFAULT_CONFIG.autoHeal.maxRetryCycles),
      model: String(autoHeal.model ?? DEFAULT_CONFIG.autoHeal.model),
    },
    paths: {
      blockedReadGlobs: Array.isArray(paths.blocked_read_globs)
        ? paths.blocked_read_globs.map(String)
        : DEFAULT_CONFIG.paths.blockedReadGlobs,
      blockedWriteGlobs: Array.isArray(paths.blocked_write_globs)
        ? paths.blocked_write_globs.map(String)
        : DEFAULT_CONFIG.paths.blockedWriteGlobs,
    },
  };
}

export function defaultConfig(): ShieldConfig {
  return structuredClone(DEFAULT_CONFIG);
}

export function findConfigPath(startDir: string): string | null {
  let current = path.resolve(startDir);
  const root = path.parse(current).root;
  while (true) {
    const candidate = path.join(current, "shield.yaml");
    if (fs.existsSync(candidate)) return candidate;
    if (current === root) return null;
    current = path.dirname(current);
  }
}

export function loadConfig(configPath?: string, cwd = process.cwd()): ShieldConfig {
  const resolved =
    configPath ?? findConfigPath(cwd) ?? path.join(cwd, "shield.yaml");
  if (!fs.existsSync(resolved)) {
    return defaultConfig();
  }
  const raw = parseYaml(fs.readFileSync(resolved, "utf8")) as Record<string, unknown>;
  return normalizeConfig(raw ?? {});
}

export function writeDefaultConfig(targetPath: string): void {
  const template = `# ShieldedShell Security Policy
version: "1.0"

sandbox:
  workspace_dir: "."
  allow_network: false
  allowed_domains: []
  max_memory_mb: 256
  cpu_timeout_ms: 300000
  overlay_enabled: true

invariants:
  ledger:
    enabled: false
    min_balance: 0.0
  routing:
    enabled: false
    allow_sensitive_public: false

auto_heal:
  max_retry_cycles: 5
  model: "claude-3-5-sonnet"

paths:
  blocked_read_globs:
    - "~/.ssh/**"
    - "~/.aws/**"
    - "**/.env"
    - "**/.env.*"
  blocked_write_globs:
    - "**/.git/**"
`;
  fs.writeFileSync(targetPath, template, "utf8");
}

export function resolveWorkspace(config: ShieldConfig, cwd: string): string {
  const workspace = path.resolve(cwd, config.sandbox.workspaceDir);
  if (!fs.existsSync(workspace)) {
    fs.mkdirSync(workspace, { recursive: true });
  }
  return workspace;
}
