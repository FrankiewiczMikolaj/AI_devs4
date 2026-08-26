import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AgentEventEmitter } from "../events/index.js";
import { RUN_LOG_ENABLED, RUNS_DIR, formatLessonPath } from "../config.js";
import { log } from "../logger.js";

export function subscribeJsonl(
  events: AgentEventEmitter,
  sessionId: string,
): () => void {
  if (!RUN_LOG_ENABLED) {
    return () => {};
  }

  const filePath = path.join(RUNS_DIR, `${sessionId}.jsonl`);
  let ready = mkdir(RUNS_DIR, { recursive: true }).then(() => {
    log.info(`jsonl log: ${formatLessonPath(filePath)}`);
  });

  const unsub = events.onAny((event) => {
    ready = ready
      .then(() => appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8"))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        log.info(`jsonl write error: ${message}`);
      });
  });

  return () => {
    unsub();
  };
}
