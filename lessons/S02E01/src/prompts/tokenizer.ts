import { getEncoding } from "js-tiktoken";
import { MAX_PROMPT_TOKENS } from "../config.js";
import type { CategorizeItem } from "../hub/types.js";
import type { PromptTokenStats } from "./types.js";

const encoding = getEncoding("o200k_base");

export const ID_PLACEHOLDER = "{id}";
export const DESCRIPTION_PLACEHOLDER = "{description}";

export function countTokens(text: string): number {
  return encoding.encode(text).length;
}

export function fillTemplate(
  template: string,
  item: CategorizeItem,
): string {
  return template
    .replaceAll(ID_PLACEHOLDER, item.id)
    .replaceAll(DESCRIPTION_PLACEHOLDER, item.description);
}

/**
 * Token stats for a template. The limit applies to the *filled* prompt, so the
 * worst-case item decides whether a template is usable.
 */
export function analyzeTemplate(
  template: string,
  items: CategorizeItem[],
): PromptTokenStats {
  const firstPlaceholder = template.indexOf(ID_PLACEHOLDER);
  const prefixTokens = countTokens(
    firstPlaceholder === -1 ? template : template.slice(0, firstPlaceholder),
  );

  if (items.length === 0) {
    const templateTokens = countTokens(template);
    return {
      prefixTokens,
      maxFilledTokens: templateTokens,
      worstCaseItemId: null,
      withinLimit: templateTokens <= MAX_PROMPT_TOKENS,
    };
  }

  let maxFilledTokens = 0;
  let worstCaseItemId: string | null = null;

  for (const item of items) {
    const tokens = countTokens(fillTemplate(template, item));
    if (tokens > maxFilledTokens) {
      maxFilledTokens = tokens;
      worstCaseItemId = item.id;
    }
  }

  return {
    prefixTokens,
    maxFilledTokens,
    worstCaseItemId,
    withinLimit: maxFilledTokens <= MAX_PROMPT_TOKENS,
  };
}
