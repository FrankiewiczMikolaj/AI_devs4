import { MAX_PROMPT_TOKENS } from "../config.js";
import { analyzeTemplate } from "../prompts/tokenizer.js";
import type { PromptVersion } from "../prompts/types.js";
import { defineTool, optionalString, requireString } from "./types.js";
import { validateTemplate } from "./template.js";

function digest(version: PromptVersion) {
  const lastRun = version.hubRuns.at(-1);
  return {
    version: version.version,
    parentVersion: version.parentVersion,
    template: version.template,
    tokenStats: version.tokenStats,
    runs: version.hubRuns.length,
    lastRun: lastRun
      ? {
          ok: lastRun.ok,
          rejectedItemId: lastRun.rejectedItemId,
          message: lastRun.message,
        }
      : null,
  };
}

export const promptVersionsTool = defineTool({
  name: "prompt_versions",
  description:
    "Read saved classifier templates and their hub test history. Actions: list, get, latest.",
  roles: ["root"],
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "get", "latest"] },
      version: { type: "string", description: "Required for action=get." },
    },
    required: ["action"],
  },
  async run(args, ctx) {
    const action = requireString(args, "action");

    if (action === "list") {
      const versions = await ctx.store.list();
      return { versions: versions.map(digest) };
    }

    if (action === "latest") {
      const latest = await ctx.store.latest();
      return { version: latest ? digest(latest) : null };
    }

    if (action === "get") {
      const found = await ctx.store.get(requireString(args, "version"));
      return { version: found ? digest(found) : null };
    }

    throw new Error(`Unknown prompt_versions action: ${action}`);
  },
});

export const saveTemplateTool = defineTool({
  name: "save_template",
  description:
    "Store a classifier template as a new version. Validates the token limit against the current items and returns tokenStats; a template over the limit is not stored.",
  roles: ["engineer"],
  parameters: {
    type: "object",
    properties: {
      template: {
        type: "string",
        description: "Template containing the {id} and {description} placeholders.",
      },
      parent_version: {
        type: "string",
        description: "Version this template is derived from, when improving one.",
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

    if (ctx.items.length === 0) {
      return { ok: false, reason: "items-unavailable" };
    }

    const tokenStats = analyzeTemplate(template, ctx.items);
    if (!tokenStats.withinLimit) {
      return {
        ok: false,
        reason: "over-token-limit",
        limit: MAX_PROMPT_TOKENS,
        tokenStats,
      };
    }

    const saved = await ctx.store.save({
      template,
      sessionId: ctx.sessionId,
      parentVersion: optionalString(args, "parent_version"),
      tokenStats,
    });

    return { ok: true, version: saved.version, tokenStats };
  },
});
