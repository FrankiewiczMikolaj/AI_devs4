import { describeModel } from "../ai/client.js";
import type { TokenTotals } from "../ai/types.js";
import type { AgentOutcome, RoleId } from "../agent/types.js";
import { ENGINEER_MODEL, ROOT_MODEL } from "../config.js";
import type { HubUsage } from "../hub/types.js";
import { log } from "../logger.js";
import type { PromptVersion } from "../prompts/types.js";
import { estimateCost, formatUsd } from "./cost.js";

const MODELS: Record<RoleId, string> = {
  root: ROOT_MODEL,
  engineer: ENGINEER_MODEL,
};

function formatThousands(tokens: number): string {
  return tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}k` : String(tokens);
}

function cachedShare(totals: TokenTotals): string {
  if (totals.inputTokens === 0) {
    return "0%";
  }
  return `${Math.round((totals.cachedInputTokens / totals.inputTokens) * 100)}%`;
}

const toUsage = (totals: TokenTotals) => ({
  inputTokens: totals.inputTokens,
  cachedInputTokens: totals.cachedInputTokens,
  outputTokens: totals.outputTokens,
});

function formatRole(role: RoleId, totals: TokenTotals): string {
  return (
    `${role.padEnd(9)} ${String(totals.requests).padStart(2)} req  ` +
    `${formatThousands(totals.inputTokens)}→${formatThousands(totals.outputTokens)} tok ` +
    `(${cachedShare(totals)} cached)  ${formatUsd(estimateCost(role, toUsage(totals)).total)}  ` +
    describeModel(MODELS[role])
  );
}

export function logRunSummary(input: {
  outcome: AgentOutcome;
  tokens: Record<RoleId, TokenTotals>;
  hub: HubUsage;
  versions: PromptVersion[];
  elapsedMs: number;
}): void {
  const roles: RoleId[] = ["root", "engineer"];
  const totalCost = roles.reduce(
    (sum, role) => sum + estimateCost(role, toUsage(input.tokens[role])).total,
    0,
  );
  const versions = `${input.versions.length} prompt version${input.versions.length === 1 ? "" : "s"}`;

  log.info(`── summary ── ${(input.elapsedMs / 1000).toFixed(1)}s`);
  log.info(
    input.outcome.ok
      ? `result: ${input.outcome.summary} in ${input.outcome.rounds} rounds, ${versions}`
      : `result: FAILED — ${input.outcome.summary} (${input.outcome.rounds} rounds, ${versions})`,
  );

  for (const role of roles) {
    log.info(formatRole(role, input.tokens[role]));
  }

  log.info(
    `hub       ${input.hub.classifyRequests} classify + ${input.hub.resets} resets`,
  );
  log.info(`total     ${formatUsd(totalCost)}`);
}
