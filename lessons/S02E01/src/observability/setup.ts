import { subscribeConsole } from "./console.js";
import { createEvents, type AgentEvents } from "./events.js";
import { subscribeJsonl } from "./jsonl.js";
import { subscribeLangfuse } from "./langfuse.js";
import { initTracing, shutdownTracing } from "./tracing.js";

export type Observability = {
  sessionId: string;
  events: AgentEvents;
  shutdown(): Promise<void>;
};

export function setupObservability(): Observability {
  const sessionId = crypto.randomUUID();
  const events = createEvents();

  initTracing();

  const unsubs = [
    subscribeConsole(events),
    subscribeJsonl(events, sessionId),
    subscribeLangfuse(events, sessionId),
  ];

  return {
    sessionId,
    events,
    async shutdown() {
      for (const unsub of unsubs) {
        await unsub();
      }
      await shutdownTracing();
    },
  };
}
