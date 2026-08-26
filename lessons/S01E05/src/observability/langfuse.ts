import { propagateAttributes } from "@langfuse/tracing";
import type { AgentEventEmitter } from "../events/index.js";
import { log } from "../logger.js";
import {
  getSpanContext,
  isTracingEnabled,
  traceAgent,
  traceGeneration,
  traceTool,
  type SpanContext,
} from "./tracing.js";

type AgentObs = NonNullable<ReturnType<typeof traceAgent>>;

export function subscribeLangfuse(
  events: AgentEventEmitter,
  sessionId: string,
): () => void {
  if (!isTracingEnabled()) {
    return () => {};
  }

  let agentObs: AgentObs | undefined;
  let agentSpanCtx: SpanContext | undefined;

  const withSession = <T>(fn: () => T): T =>
    propagateAttributes(
      {
        sessionId,
        traceName: "railway",
      },
      fn,
    );

  const unsubs = [
    events.on("agent.started", (event) => {
      agentObs = withSession(() =>
        traceAgent("railway", {
          input: event.task,
          metadata: {
            sessionId: event.sessionId,
            model: event.model,
          },
          startTime: new Date(event.timestamp),
        }),
      );

      if (agentObs) {
        agentObs.setTraceIO({ input: event.task });
        agentSpanCtx = getSpanContext(agentObs);
      }
    }),

    events.on("agent.completed", (event) => {
      if (!agentObs) {
        return;
      }

      agentObs.update({
        output: {
          ok: event.ok,
          rounds: event.rounds,
          flag: event.flag,
          summary: event.summary,
        },
      });
      agentObs.setTraceIO({ output: event.summary });
      agentObs.end(new Date(event.timestamp));
      agentObs = undefined;
      agentSpanCtx = undefined;
    }),

    events.on("agent.failed", (event) => {
      if (!agentObs) {
        return;
      }

      agentObs.update({ level: "ERROR", statusMessage: event.error });
      agentObs.end(new Date(event.timestamp));
      agentObs = undefined;
      agentSpanCtx = undefined;
    }),

    events.on("generation.completed", (event) => {
      const obs = withSession(() =>
        traceGeneration(event.model, {
          model: event.model,
          input: event.input,
          metadata: { round: event.round, sessionId: event.sessionId },
          parentSpanContext: agentSpanCtx,
          startTime: new Date(event.startTime),
        }),
      );

      if (!obs) {
        return;
      }

      obs.update({
        output: event.output,
        usageDetails: event.usage
          ? {
              input: event.usage.inputTokens,
              output: event.usage.outputTokens,
              total: event.usage.totalTokens,
            }
          : undefined,
      });
      obs.end(new Date(event.startTime + event.durationMs));
    }),

    events.on("tool.completed", (event) => {
      const obs = withSession(() =>
        traceTool(event.name, {
          input: event.arguments,
          metadata: { round: event.round, sessionId: event.sessionId },
          parentSpanContext: agentSpanCtx,
          startTime: new Date(event.startTime),
        }),
      );

      if (!obs) {
        return;
      }

      obs.update({ output: event.output });
      obs.end(new Date(event.startTime + event.durationMs));
    }),

    events.on("tool.failed", (event) => {
      const obs = withSession(() =>
        traceTool(event.name, {
          input: event.arguments,
          metadata: { round: event.round, sessionId: event.sessionId },
          parentSpanContext: agentSpanCtx,
          startTime: new Date(event.startTime),
        }),
      );

      if (!obs) {
        return;
      }

      obs.update({ level: "ERROR", statusMessage: event.error });
      obs.end(new Date(event.startTime + event.durationMs));
    }),
  ];

  log.info("langfuse subscriber attached");

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
