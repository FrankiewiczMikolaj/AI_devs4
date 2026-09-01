import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { formatLessonPath, RUNS_DIR, RUN_LOG_ENABLED } from "../config.js";
import { log } from "../logger.js";
import type { AgentEvents } from "./events.js";

export type JsonlOptions = {
  enabled?: boolean;
  runsDir?: string;
};

export function subscribeJsonl(
  events: AgentEvents,
  sessionId: string,
  options: JsonlOptions = {},
): () => Promise<void> {
  const enabled = options.enabled ?? RUN_LOG_ENABLED;
  if (!enabled) {
    return async () => {};
  }

  const runsDir = options.runsDir ?? RUNS_DIR;
  const filePath = path.join(runsDir, `${sessionId}.jsonl`);
  let writes = mkdir(runsDir, { recursive: true }).then(() => {
    log.info(`jsonl log: ${formatLessonPath(filePath)}`);
  });

  const unsub = events.onAny((event) => {
    writes = writes
      .then(() => appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8"))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        log.info(`jsonl write error: ${message}`);
      });
  });

  return async () => {
    unsub();
    await writes;
  };
}
