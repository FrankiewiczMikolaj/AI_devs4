import { MAX_PROMPT_TOKENS } from "../config.js";
import { runCycle, summarizeCycle } from "../hub/cycle.js";
import { analyzeTemplate } from "../prompts/tokenizer.js";
import { defineTool, optionalString, requireString } from "./types.js";
import { validateTemplate } from "./template.js";

export const categorizeCycleTool = defineTool({
  name: "categorize_cycle",
  description:
    "Test a template against the hub: optional budget reset, fresh CSV, then one classify request per item with {id} and {description} filled in locally. Stops at the first rejected item and reports it. Returns a flag when every item is accepted.",
  roles: ["root"],
  parameters: {
    type: "object",
    properties: {
      template: {
        type: "string",
        description: "Classifier template containing {id} and {description}.",
      },
      reset: {
        type: "boolean",
        description:
          "Reset the hub PP budget before the cycle. Needed after a failed cycle.",
      },
      version: {
        type: "string",
        description:
          "Saved version to attach the result to; defaults to the latest one.",
      },
    },
    required: ["template"],
  },
  async run(args, ctx) {
    const template = requireString(args, "template");

    const invalid = validateTemplate(template);
    if (invalid) {
      return { ok: false, reason: invalid };
    }

    const previous = ctx.testedTemplates.get(template);
    if (previous) {
      return {
        ok: false,
        reason: "already-tested",
        previousHubMessage: previous,
      };
    }

    const { items } = await ctx.hub.fetchItems();
    const tokenStats = analyzeTemplate(template, items);
    if (!tokenStats.withinLimit) {
      return {
        ok: false,
        reason: "over-token-limit",
        limit: MAX_PROMPT_TOKENS,
        tokenStats,
      };
    }

    const outcome = await runCycle({
      client: ctx.hub,
      template,
      items,
      reset: args.reset === true,
      onAttempt: (attempt, index, total) => {
        ctx.events.emit({
          type: "hub.attempt",
          index,
          total,
          itemId: attempt.item.id,
          accepted: attempt.reply.accepted,
          flag: attempt.reply.flag,
          status: attempt.reply.status,
          message: attempt.reply.message,
          timestamp: Date.now(),
        });
      },
    });

    const summary = summarizeCycle(outcome);

    if (!outcome.ok) {
      ctx.testedTemplates.set(template, outcome.message || "no flag returned");
    }

    const version =
      optionalString(args, "version") ?? (await ctx.store.latest())?.version;

    if (version) {
      await ctx.store.appendHubRun(version, {
        runAt: new Date().toISOString(),
        ok: outcome.ok,
        itemsTested: summary.itemsTested,
        rejectedItemId: summary.rejectedItem?.id ?? null,
        ppUsed: outcome.budget?.ppUsed ?? null,
        message: outcome.message,
      });
    }

    return { ...summary, version: version ?? null, tokenStats };
  },
});
