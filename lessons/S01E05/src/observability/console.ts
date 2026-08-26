import type { AgentEventEmitter } from "../events/index.js";
import { log } from "../logger.js";
import type { RailwayToolResult } from "../types.js";

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatToolResult(output: unknown): string {
  if (typeof output !== "object" || output === null) {
    return "";
  }

  const result = output as Partial<RailwayToolResult>;
  const parts: string[] = [];

  if (typeof result.status === "number") {
    parts.push(`status=${result.status}`);
  }
  if (typeof result.attempts === "number" && result.attempts > 1) {
    parts.push(`attempts=${result.attempts}`);
  }
  if (typeof result.waitedMs === "number" && result.waitedMs > 0) {
    parts.push(`waited=${formatSeconds(result.waitedMs)}`);
  }
  if (typeof result.flag === "string" && result.flag) {
    parts.push(`flag=${result.flag}`);
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function subscribeConsole(events: AgentEventEmitter): () => void {
  const unsubs = [
    events.on("agent.started", (event) => {
      log.info(`session ${event.sessionId.slice(0, 8)}… model=${event.model}`);
    }),
    events.on("turn.started", (event) => {
      log.info(`round ${event.round}`);
    }),
    events.on("generation.completed", (event) => {
      const usage = event.usage;
      log.data(
        `llm ${event.durationMs}ms` +
          (usage
            ? ` | ${usage.inputTokens} in + ${usage.outputTokens} out`
            : ""),
      );
    }),
    events.on("tool.completed", (event) => {
      log.data(
        `→ ${event.name}(${JSON.stringify(event.arguments)})` +
          formatToolResult(event.output) +
          ` | ${event.durationMs}ms`,
      );
    }),
    events.on("tool.failed", (event) => {
      log.data(`✗ ${event.name}: ${event.error}`);
    }),
    events.on("agent.completed", (event) => {
      log.info(
        `session done ok=${event.ok} rounds=${event.rounds}` +
          (event.flag ? ` ${event.flag}` : ""),
      );
    }),
    events.on("agent.failed", (event) => {
      log.info(`session failed: ${event.error}`);
    }),
  ];

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
