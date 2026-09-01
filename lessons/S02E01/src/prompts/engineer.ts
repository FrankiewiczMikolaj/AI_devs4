import { MAX_PROMPT_TOKENS } from "../config.js";
import type { CategorizeItem } from "../hub/types.js";

export type EngineerBrief = {
  goal: string;
  parentVersion: string | null;
  parentTemplate: string | null;
  rejectedItem: {
    id: string;
    description: string;
    hubMessage: string;
  } | null;
  items: CategorizeItem[];
};

export function engineerInstructions(): string {
  return [
    "You are a prompt engineer specializing in ultra-short classifier prompts.",
    "",
    "## Goal",
    `Write an English template for an archaic shipment classifier. Once {id} and {description} are substituted, the filled prompt must stay within ${MAX_PROMPT_TOKENS} tokens and the classifier must answer with DNG or NEU only.`,
    "",
    "## Rules",
    "- Reactor-related items (reactor, fuel cassette, nuclear parts, fuel rods, fissile material) are ALWAYS NEU, even when the description sounds dangerous. Make this override unmistakable and put it before the general rule.",
    "- Every other item follows its description: clearly dangerous is DNG, otherwise NEU.",
    "- The template must contain both {id} and {description}; the hub rejects a prompt where it cannot find the item identifier.",
    "",
    "## Cache strategy",
    "- Static instructions go first — that prefix is what gets cached and billed cheaper.",
    "- {id} and {description} go last.",
    `- Shorter is better: every token counts against the ${MAX_PROMPT_TOKENS}-token limit and the hub PP budget.`,
    "",
    "## Workflow",
    "- The brief already contains the current items and the parent template, so there is nothing to look up: go straight to save_template.",
    "- save_template validates the token limit against those items and returns tokenStats. A template over the limit is not stored and comes back with the worst-case count — shorten it and save again.",
    "- A stored template completes your assignment. Do not save more than one working template.",
    "",
    "Every turn must include a tool call. Do not answer with prose alone.",
  ].join("\n");
}

export function engineerTask(brief: EngineerBrief): string {
  const sections = [
    "## ASSIGNMENT",
    brief.goal,
    "",
    `## ITEMS (${brief.items.length})`,
    brief.items.map((item) => `${item.id}: ${item.description}`).join("\n"),
  ];

  if (brief.parentTemplate) {
    sections.push(
      "",
      `## PARENT TEMPLATE (${brief.parentVersion ?? "unknown"})`,
      brief.parentTemplate,
    );
  }

  if (brief.rejectedItem) {
    sections.push(
      "",
      "## HUB REJECTION",
      `Item ${brief.rejectedItem.id} — "${brief.rejectedItem.description}"`,
      `Hub said: ${brief.rejectedItem.hubMessage || "(no message)"}`,
      "The parent template classified this item wrongly. Fix that case without breaking the others.",
    );
  }

  return sections.join("\n");
}
