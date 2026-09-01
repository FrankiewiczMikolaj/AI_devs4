import type { FunctionToolSchema } from "../ai/types.js";
import type { RoleId } from "../agent/types.js";
import type { HubClient } from "../hub/client.js";
import type { CategorizeItem } from "../hub/types.js";
import type { EngineerBrief } from "../prompts/engineer.js";
import type { PromptStore } from "../prompts/store.js";
import type { AgentEvents } from "../observability/events.js";

export type DelegateOutcome = {
  ok: boolean;
  version: string | null;
  template: string | null;
  summary: string;
  rounds: number;
};

export type ToolContext = {
  sessionId: string;
  role: RoleId;
  spanId: string;
  hub: HubClient;
  store: PromptStore;
  events: AgentEvents;
  items: CategorizeItem[];
  testedTemplates: Map<string, string>;
  runEngineer(
    brief: EngineerBrief,
    parentSpanId: string,
  ): Promise<DelegateOutcome>;
};

export type Tool = {
  schema: FunctionToolSchema;
  roles: readonly RoleId[];
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
};

export function defineTool(input: {
  name: string;
  description: string;
  roles: readonly RoleId[];
  parameters: Record<string, unknown>;
  run: Tool["run"];
}): Tool {
  return {
    schema: {
      type: "function",
      name: input.name,
      description: input.description,
      parameters: { additionalProperties: false, ...input.parameters },
      strict: false,
    },
    roles: input.roles,
    run: input.run,
  };
}

export function requireString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : null;
}
