import type { FunctionToolSchema } from "../ai/types.js";
import type { RoleId } from "../agent/types.js";
import { categorizeCycleTool } from "./categorize-cycle.js";
import { delegateTool } from "./delegate.js";
import { promptVersionsTool, saveTemplateTool } from "./prompt-versions.js";
import type { Tool, ToolContext } from "./types.js";

export const TOOLS: readonly Tool[] = [
  categorizeCycleTool,
  delegateTool,
  promptVersionsTool,
  saveTemplateTool,
];

export function toolsFor(role: RoleId): FunctionToolSchema[] {
  return TOOLS.filter((tool) => tool.roles.includes(role)).map(
    (tool) => tool.schema,
  );
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const tool = TOOLS.find((candidate) => candidate.schema.name === name);

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (!tool.roles.includes(ctx.role)) {
    throw new Error(`Tool ${name} is not available to the ${ctx.role} agent`);
  }

  return tool.run(args, ctx);
}
