import { fillTemplate } from "../prompts/tokenizer.js";
import type { HubClient } from "./client.js";
import type { CategorizeItem, CycleOutcome, ItemAttempt } from "./types.js";

export type CycleSummary = {
  ok: boolean;
  flag: string | null;
  resetPerformed: boolean;
  itemsTested: number;
  itemsTotal: number;
  hubMessage: string;
  budgetExceeded: boolean;
  budget: CycleOutcome["budget"];
  rejectedItem: {
    id: string;
    description: string;
    sentPrompt: string;
    hubStatus: number;
    hubMessage: string;
  } | null;
};

/**
 * Sends one prompt per item and stops at the first rejection — the hub charges
 * for every call, so there is nothing to learn from continuing past a failure.
 */
export async function runCycle(input: {
  client: HubClient;
  template: string;
  items: CategorizeItem[];
  reset: boolean;
  onAttempt?: (attempt: ItemAttempt, index: number, total: number) => void;
}): Promise<CycleOutcome> {
  let resetPerformed = false;
  if (input.reset) {
    await input.client.reset();
    resetPerformed = true;
  }

  const attempts: ItemAttempt[] = [];
  let rejected: ItemAttempt | null = null;
  let flag: string | null = null;
  let budgetExceeded = false;
  let budget: CycleOutcome["budget"] = null;
  let message = "";

  for (const [index, item] of input.items.entries()) {
    const prompt = fillTemplate(input.template, item);
    const reply = await input.client.classify(prompt);
    const attempt: ItemAttempt = {
      item,
      prompt,
      reply,
    };

    attempts.push(attempt);
    input.onAttempt?.(attempt, index, input.items.length);

    budget = reply.budget ?? budget;
    message = reply.message;

    if (reply.flag) {
      flag = reply.flag;
      break;
    }

    if (reply.budgetExceeded) {
      budgetExceeded = true;
      break;
    }

    if (!reply.accepted) {
      rejected = attempt;
      break;
    }
  }

  return {
    ok: Boolean(flag),
    flag,
    resetPerformed,
    itemsTotal: input.items.length,
    attempts,
    rejected,
    budget,
    budgetExceeded,
    message,
  };
}

/** Cycle reduced to the facts an agent needs to decide what to change next. */
export function summarizeCycle(outcome: CycleOutcome): CycleSummary {
  return {
    ok: outcome.ok,
    flag: outcome.flag,
    resetPerformed: outcome.resetPerformed,
    itemsTested: outcome.attempts.length,
    itemsTotal: outcome.itemsTotal,
    hubMessage: outcome.message,
    budgetExceeded: outcome.budgetExceeded,
    budget: outcome.budget,
    rejectedItem: outcome.rejected
      ? {
          id: outcome.rejected.item.id,
          description: outcome.rejected.item.description,
          sentPrompt: outcome.rejected.prompt,
          hubStatus: outcome.rejected.reply.status,
          hubMessage: outcome.rejected.reply.message,
        }
      : null,
  };
}
