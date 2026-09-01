import type { EngineerBrief } from "../prompts/engineer.js";
import { defineTool, optionalString, requireString } from "./types.js";

export const delegateTool = defineTool({
  name: "delegate",
  description:
    "Hand prompt engineering to a specialist subagent. It returns a saved template version. Pass the rejected item from the last cycle so the subagent knows what to fix.",
  roles: ["root"],
  parameters: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description:
          "What the template has to achieve or what to change, in one or two sentences.",
      },
      parent_version: {
        type: "string",
        description:
          "Version to improve. Its template is looked up and included in the brief.",
      },
      rejected_item_id: {
        type: "string",
        description: "Item id the hub rejected in the last cycle.",
      },
      hub_message: {
        type: "string",
        description: "What the hub replied for that item.",
      },
    },
    required: ["goal"],
  },
  async run(args, ctx) {
    const goal = requireString(args, "goal");
    const parentVersion = optionalString(args, "parent_version");
    const parent = parentVersion
      ? await ctx.store.get(parentVersion)
      : await ctx.store.latest();

    const rejectedId = optionalString(args, "rejected_item_id");
    const rejectedItem = rejectedId
      ? {
          id: rejectedId,
          description:
            ctx.items.find((item) => item.id === rejectedId)?.description ?? "",
          hubMessage: optionalString(args, "hub_message") ?? "",
        }
      : null;

    const brief: EngineerBrief = {
      goal,
      parentVersion: parent?.version ?? null,
      parentTemplate: parent?.template ?? null,
      rejectedItem,
      items: ctx.items,
    };

    const outcome = await ctx.runEngineer(brief, ctx.spanId);

    return {
      ok: outcome.ok,
      version: outcome.version,
      template: outcome.template,
      summary: outcome.summary,
      rounds: outcome.rounds,
    };
  },
});
