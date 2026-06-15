import { describe, expect, it } from "vitest";
import {
  buildFromProfile,
  ENGINE_PROFILES,
  LOOP_TOOL_HINT,
  SUPPORTED_ENGINES,
  type EngineProfile,
} from "./engine-profiles.js";
import { buildLoopCommands, packageRoot, resolvePromptPaths } from "./engines.js";

describe("engine profiles", () => {
  it("defines a profile for every supported engine", () => {
    for (const engine of SUPPORTED_ENGINES) {
      expect(ENGINE_PROFILES[engine].id).toBe(engine);
    }
  });

  it("builds dev and audit commands for every profile", () => {
    const workspace = packageRoot();
    for (const engine of SUPPORTED_ENGINES) {
      const { devCommand, auditCommand } = buildLoopCommands(workspace, engine);
      expect(devCommand.length).toBeGreaterThan(10);
      expect(auditCommand.length).toBeGreaterThan(10);
      if (engine !== "openhands-sdk") {
        expect(devCommand).toContain(LOOP_TOOL_HINT.trim().slice(0, 20));
      }
    }
  });

  it("uses pipe-file delivery for cline with json headless flags", () => {
    const prompts = resolvePromptPaths(packageRoot());
    const cmd = buildFromProfile(
      ENGINE_PROFILES.cline,
      prompts.developer,
      { workspace: packageRoot(), timeoutSeconds: 900 },
      packageRoot(),
    );
    expect(cmd).toContain("--json");
    expect(cmd).toContain("--auto-approve true");
    expect(cmd).toMatch(/type |cat /);
  });

  it("uses phase file bindings for aider and opencode", () => {
    const workspace = packageRoot();
    const aider = buildLoopCommands(workspace, "aider");
    expect(aider.devCommand).toContain("developer_output.json");
    expect(aider.auditCommand).toContain("auditor_output.json");

    const opencode = buildLoopCommands(workspace, "opencode");
    expect(opencode.devCommand).toContain("shared_context.txt");
    expect(opencode.devCommand).toContain("-f ");
  });

  it("uses script delivery for openhands-sdk", () => {
    const profile = ENGINE_PROFILES["openhands-sdk"] satisfies EngineProfile;
    expect(profile.delivery).toBe("script");
    const prompts = resolvePromptPaths(packageRoot());
    const cmd = buildFromProfile(profile, prompts.developer, { workspace: packageRoot() }, packageRoot());
    expect(cmd).toContain("openhands-loop.py");
  });
});
