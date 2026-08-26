import { createEventEmitter, type AgentEventEmitter } from "../events/index.js";
import { log } from "../logger.js";
import { subscribeConsole } from "./console.js";
import { subscribeJsonl } from "./jsonl.js";
import { subscribeLangfuse } from "./langfuse.js";
import { initTracing, shutdownTracing } from "./tracing.js";

export type Observability = {
  sessionId: string;
  events: AgentEventEmitter;
  shutdown: () => Promise<void>;
};

export function setupObservability(): Observability {
  const sessionId = crypto.randomUUID();
  const events = createEventEmitter();

  initTracing();

  const unsubs = [
    subscribeConsole(events),
    subscribeJsonl(events, sessionId),
    subscribeLangfuse(events, sessionId),
  ];

  log.info(`observability session=${sessionId}`);

  return {
    sessionId,
    events,
    async shutdown() {
      for (const unsub of unsubs) {
        unsub();
      }
      await shutdownTracing();
    },
  };
}
