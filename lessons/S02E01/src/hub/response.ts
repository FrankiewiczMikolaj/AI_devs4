import type { HubBudget, HubReply } from "./types.js";

const FLAG_PATTERN = /\{FLG:[^}]+\}/;
const REJECTION_PATTERN = /not\s+accepted|rejected|odrzucon/i;
/**
 * Deliberately narrow: a plain rejection that happens to mention tokens must
 * not be read as an exhausted budget, or the cycle would stop without
 * reporting which item failed.
 */
const BUDGET_PATTERN = /(budget|budżet|\bpp\b)/i;
const EXHAUSTED_PATTERN = /(exceed|przekrocz|skończ|brak|out of|limit)/i;

const MESSAGE_KEYS = ["message", "error", "detail", "hint"];

export function extractFlag(value: unknown): string | null {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return FLAG_PATTERN.exec(text)?.[0] ?? null;
}

function collectMessages(value: unknown, parts: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) {
      parts.push(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectMessages(entry, parts);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const key of MESSAGE_KEYS) {
      if (key in value) {
        collectMessages((value as Record<string, unknown>)[key], parts);
      }
    }
  }
}

export function extractMessage(body: unknown): string {
  const parts: string[] = [];
  collectMessages(body, parts);
  return parts.join(" | ");
}

function readNumber(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

/** Key lookup that ignores case and separators, so `pp_used` and `ppUsed` both hit. */
function canonicalKeys(value: Record<string, unknown>): Map<string, unknown> {
  return new Map(
    Object.entries(value).map(([key, entry]) => [
      key.toLowerCase().replaceAll(/[^a-z0-9]/g, ""),
      entry,
    ]),
  );
}

export function extractBudget(body: unknown): HubBudget | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const nested = record.budget ?? record.usage;
  const source =
    typeof nested === "object" && nested !== null
      ? (nested as Record<string, unknown>)
      : record;

  const keys = canonicalKeys(source);
  const budget: HubBudget = {
    inputTokens: readNumber(keys.get("inputtokens")),
    cachedTokens: readNumber(keys.get("cachedtokens")),
    outputTokens: readNumber(keys.get("outputtokens")),
    ppUsed: readNumber(keys.get("ppused")),
    ppRemaining: readNumber(keys.get("ppremaining")),
  };

  const present = Object.entries(budget).filter(
    ([, value]) => value !== undefined,
  );
  return present.length > 0 ? (Object.fromEntries(present) as HubBudget) : null;
}

export function isBudgetExhausted(
  message: string,
  budget: HubBudget | null,
): boolean {
  if (budget?.ppRemaining !== undefined && budget.ppRemaining <= 0) {
    return true;
  }
  return BUDGET_PATTERN.test(message) && EXHAUSTED_PATTERN.test(message);
}

export function parseHubReply(input: {
  status: number;
  httpOk: boolean;
  body: unknown;
}): HubReply {
  const message = extractMessage(input.body);
  const flag = extractFlag(input.body);
  const budget = extractBudget(input.body);
  const budgetExceeded = !flag && isBudgetExhausted(message, budget);
  const accepted =
    Boolean(flag) ||
    (input.httpOk && !budgetExceeded && !REJECTION_PATTERN.test(message));

  return {
    status: input.status,
    accepted,
    message,
    flag,
    budget,
    budgetExceeded,
  };
}
