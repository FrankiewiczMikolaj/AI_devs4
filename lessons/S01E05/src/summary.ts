import { AI_MODEL, MODEL_PRICE_PER_1M } from "./config.js";
import { getApiUsage } from "./api.js";
import { log } from "./logger.js";
import { getRailwayUsage } from "./native/railway.js";

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens / 1_000_000) * MODEL_PRICE_PER_1M.input +
    (outputTokens / 1_000_000) * MODEL_PRICE_PER_1M.output
  );
}

export function logRunSummary(input: {
  ok: boolean;
  rounds: number;
  summary: string;
}): void {
  const llm = getApiUsage();
  const hub = getRailwayUsage();
  const cost = estimateCostUsd(llm.inputTokens, llm.outputTokens);

  log.info("── summary ──");
  log.info(input.ok ? `result: ${input.summary}` : `result: FAILED — ${input.summary}`);
  log.info(`rounds: ${input.rounds}`);
  log.info(
    `llm: ${llm.requests} requests | ${llm.inputTokens} in + ${llm.outputTokens} out = ${llm.totalTokens} tokens`,
  );
  log.info(
    `cost: ${formatUsd(cost)} (${AI_MODEL} @ $${MODEL_PRICE_PER_1M.input}/1M in, $${MODEL_PRICE_PER_1M.output}/1M out)`,
  );
  log.info(
    `hub: ${hub.requests} calls | ${hub.overload503}×503 | ${hub.rateLimited429}×429 | waited ${formatSeconds(hub.waitedMs)}`,
  );
}
