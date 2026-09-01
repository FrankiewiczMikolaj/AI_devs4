import { MODEL_PRICE_PER_1M } from "../config.js";
import type { RoleId } from "../agent/types.js";
import type { TokenUsage } from "../observability/events.js";

export type Cost = {
  input: number;
  output: number;
  total: number;
};

export function estimateCost(role: RoleId, usage: TokenUsage): Cost {
  const price = MODEL_PRICE_PER_1M[role];
  const freshInput = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  const input =
    (freshInput / 1_000_000) * price.input +
    (usage.cachedInputTokens / 1_000_000) * price.cachedInput;
  const output = (usage.outputTokens / 1_000_000) * price.output;

  return { input, output, total: input + output };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}
