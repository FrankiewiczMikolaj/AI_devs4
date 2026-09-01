import { describe, expect, test } from "bun:test";
import type { RoleId } from "../agent/types.js";
import type { HubClient } from "../hub/client.js";
import type { CategorizeItem } from "../hub/types.js";
import { createEvents } from "../observability/events.js";
import type { PromptStore } from "../prompts/store.js";
import type { PromptVersion } from "../prompts/types.js";
import { runTool, TOOLS, toolsFor } from "./registry.js";
import type { ToolContext } from "./types.js";

const ITEMS: CategorizeItem[] = [{ id: "i1", description: "safe box" }];

const unreachableHub = (): HubClient =>
  ({
    async fetchItems() {
      throw new Error("hub must not be contacted");
    },
    async classify() {
      throw new Error("hub must not be contacted");
    },
    async reset() {
      throw new Error("hub must not be contacted");
    },
    usage: () => ({ classifyRequests: 0, resets: 0 }),
  }) satisfies HubClient;

const emptyStore = (): PromptStore =>
  ({
    async list() {
      return [];
    },
    async get() {
      return null;
    },
    async latest() {
      return null;
    },
    async save(input) {
      return {
        version: "v001",
        createdAt: "2026-09-01T06:00:00.000Z",
        sessionId: input.sessionId,
        parentVersion: input.parentVersion,
        template: input.template,
        tokenStats: input.tokenStats,
        hubRuns: [],
      } satisfies PromptVersion;
    },
    async appendHubRun() {},
  }) satisfies PromptStore;

function makeContext(role: RoleId, overrides: Partial<ToolContext> = {}) {
  return {
    sessionId: "session-1",
    role,
    spanId: "span-1",
    hub: unreachableHub(),
    store: emptyStore(),
    events: createEvents(),
    items: ITEMS,
    testedTemplates: new Map<string, string>(),
    async runEngineer() {
      throw new Error("not used in this test");
    },
    ...overrides,
  } satisfies ToolContext;
}

describe("tool registry", () => {
  test("every tool has a unique name and at least one role", () => {
    const names = TOOLS.map((tool) => tool.schema.name);

    expect(new Set(names).size).toBe(names.length);
    for (const tool of TOOLS) {
      expect(tool.roles.length).toBeGreaterThan(0);
    }
  });

  test("each role gets its own tool set", () => {
    expect(toolsFor("root").map((tool) => tool.name)).toEqual([
      "categorize_cycle",
      "delegate",
      "prompt_versions",
    ]);
    expect(toolsFor("engineer").map((tool) => tool.name)).toEqual([
      "save_template",
    ]);
  });

  test("rejects an unknown tool", () => {
    expect(runTool("nope", {}, makeContext("root"))).rejects.toThrow(
      /Unknown tool: nope/,
    );
  });

  test("rejects a tool the role may not use", () => {
    expect(
      runTool("categorize_cycle", { template: "x" }, makeContext("engineer")),
    ).rejects.toThrow(/not available to the engineer agent/);
  });

  test("writing a template is out of reach for the orchestrator", () => {
    expect(
      runTool("save_template", { template: "{id} {description}" }, makeContext("root")),
    ).rejects.toThrow(/not available to the root agent/);
  });
});

describe("categorize_cycle guards", () => {
  test("a template without {id} is refused without spending budget", async () => {
    const result = await runTool(
      "categorize_cycle",
      { template: "Classify {description}" },
      makeContext("root"),
    );

    expect(result).toEqual({ ok: false, reason: "missing-id-placeholder" });
  });

  test("a template without {description} is refused too", async () => {
    const result = await runTool(
      "categorize_cycle",
      { template: "Classify {id}" },
      makeContext("root"),
    );

    expect(result).toEqual({
      ok: false,
      reason: "missing-description-placeholder",
    });
  });

  test("a template that already failed is refused as a result, not an error", async () => {
    const template = "Classify {id} {description}";
    const ctx = makeContext("root", {
      testedTemplates: new Map([[template, "NOT ACCEPTED"]]),
    });

    expect(await runTool("categorize_cycle", { template }, ctx)).toEqual({
      ok: false,
      reason: "already-tested",
      previousHubMessage: "NOT ACCEPTED",
    });
  });
});

describe("save_template", () => {
  const save = (template: string) =>
    runTool("save_template", { template }, makeContext("engineer"));

  test("refuses a template that busts the token limit", async () => {
    const result = (await save(
      `${"be very careful with this shipment ".repeat(20)}{id} {description}`,
    )) as { ok: boolean; reason: string };

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("over-token-limit");
  });

  test("refuses a template that drops a placeholder", async () => {
    expect(await save("Classify. DESC:{description}")).toEqual({
      ok: false,
      reason: "missing-id-placeholder",
    });
  });

  test("stores a valid template and reports its token stats", async () => {
    const result = (await save("Classify. ID:{id} DESC:{description}")) as {
      ok: boolean;
      version: string;
    };

    expect(result.ok).toBe(true);
    expect(result.version).toBe("v001");
  });
});
