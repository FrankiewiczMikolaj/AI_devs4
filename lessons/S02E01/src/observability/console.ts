import type { RoleId } from "../agent/types.js";
import { log } from "../logger.js";
import type { AgentEvents } from "./events.js";

const MAX_ARG_CHARS = 90;
const MAX_MESSAGE_CHARS = 70;

function prefix(role: RoleId): string {
  return role === "root" ? "root" : "  engineer";
}

function collapse(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

function shorten(text: string, limit: number): string {
  const flat = collapse(text);
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

/** Long values (templates, briefs) are summarised — full payloads go to Langfuse. */
function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) =>
      typeof value === "string"
        ? `${key}="${shorten(value, MAX_ARG_CHARS)}"`
        : `${key}=${JSON.stringify(value)}`,
    )
    .join(" ");
}

function formatOutput(output: unknown): string {
  if (typeof output !== "object" || output === null) {
    return "";
  }

  const record = output as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.ok === "boolean") {
    parts.push(record.ok ? "ok" : "failed");
  }
  if (typeof record.reason === "string") {
    parts.push(record.reason);
  }
  if (typeof record.version === "string") {
    parts.push(record.version);
  }
  if (Array.isArray(record.versions)) {
    parts.push(`${record.versions.length} versions`);
  }

  const stats = record.tokenStats as
    | { prefixTokens?: number; maxFilledTokens?: number }
    | undefined;
  if (stats?.prefixTokens !== undefined) {
    parts.push(
      `${stats.prefixTokens} tok prefix / ${stats.maxFilledTokens} worst-case`,
    );
  }

  return parts.join(" ");
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

type RejectedItem = { id: string; description: string; hubMessage: string };

function readRejectedItem(output: unknown): RejectedItem | null {
  const candidate = (output as { rejectedItem?: unknown } | null)?.rejectedItem;
  return typeof candidate === "object" && candidate !== null
    ? (candidate as RejectedItem)
    : null;
}

export function subscribeConsole(events: AgentEvents): () => void {
  const unsubs = [
    events.on("agent.started", (event) => {
      if (event.role === "engineer") {
        log.info(`  engineer ▸ briefed, model=${event.model}`);
      }
    }),

    events.on("generation.completed", (event) => {
      const { inputTokens, cachedInputTokens, outputTokens } = event.usage;
      log.info(
        `${prefix(event.role)} ▸ round ${event.round}  ` +
          `llm ${formatSeconds(event.durationMs)}  ` +
          `${inputTokens}→${outputTokens} tok (cache ${cachedInputTokens})`,
      );
    }),

    events.on("generation.failed", (event) => {
      log.info(
        `${prefix(event.role)} ▸ round ${event.round}  llm failed: ${event.error}`,
      );
    }),

    events.on("tool.started", (event) => {
      log.data(
        `${prefix(event.role)}   → ${event.name}(${formatArgs(event.arguments)})`,
      );
    }),

    events.on("tool.completed", (event) => {
      const summary = collapse(
        `${event.name} ${formatOutput(event.output)} ${formatSeconds(event.durationMs)}`,
      );
      log.data(`${prefix(event.role)}   ← ${summary}`);

      const rejected = readRejectedItem(event.output);
      if (rejected) {
        log.data(
          `      rejected ${rejected.id} "${shorten(rejected.description, MAX_ARG_CHARS)}" ` +
            `→ ${shorten(rejected.hubMessage, MAX_MESSAGE_CHARS)}`,
        );
      }
    }),

    events.on("tool.failed", (event) => {
      log.data(`${prefix(event.role)}   ✗ ${event.name}: ${event.error}`);
    }),

    events.on("hub.attempt", (event) => {
      const position = `[${event.index + 1}/${event.total}]`;
      if (event.flag) {
        log.data(`      ${position} ${event.itemId} FLAG`);
        return;
      }
      if (event.accepted) {
        log.data(`      ${position} ${event.itemId} ok`);
        return;
      }
      log.data(
        `      ${position} ${event.itemId} REJECTED (${event.status}) ` +
          shorten(event.message, MAX_MESSAGE_CHARS),
      );
    }),

    events.on("agent.completed", (event) => {
      const { ok, rounds, summary } = event.outcome;
      const label = `${rounds} round${rounds === 1 ? "" : "s"}`;
      log.info(
        `${prefix(event.role)} ▸ ${ok ? summary : `FAILED — ${summary}`} (${label})`,
      );
    }),

    events.on("agent.failed", (event) => {
      log.info(`${prefix(event.role)} ▸ crashed: ${event.error}`);
    }),
  ];

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
