import { propagateAttributes } from "@langfuse/tracing";
import { TASK_NAME } from "../config.js";
import { estimateCost } from "../report/cost.js";
import type { AgentEvents } from "./events.js";
import {
  isTracingEnabled,
  recordEvent,
  spanContextOf,
  startSpan,
  updateSpan,
  type Observation,
  type ObservationAttributes,
  type ObservationType,
} from "./tracing.js";

const AGENT_SPAN_NAMES = {
  root: "categorize-orchestrator",
  engineer: "prompt-engineer",
} as const;

/**
 * Mirrors agent events onto Langfuse observations. Spans open on `*.started`
 * and close on `*.completed` / `*.failed`, so a run in progress is visible and
 * a crash leaves an errored span instead of no span at all.
 */
export function subscribeLangfuse(
  events: AgentEvents,
  sessionId: string,
): () => void {
  if (!isTracingEnabled()) {
    return () => {};
  }

  const open = new Map<string, Observation>();
  const baseTags = ["s02e01", "two-agent"];
  let lastVersion: string | null = null;

  const withTrace = <T>(tags: string[], create: () => T): T =>
    propagateAttributes({ sessionId, traceName: TASK_NAME, tags }, create);

  const begin = (input: {
    spanId: string;
    parentSpanId: string | null;
    name: string;
    type: ObservationType;
    attributes: ObservationAttributes;
    startTime: number;
  }): Observation => {
    const parent = input.parentSpanId
      ? open.get(input.parentSpanId)
      : undefined;

    const observation = withTrace(baseTags, () =>
      startSpan({
        name: input.name,
        type: input.type,
        attributes: input.attributes,
        parent: parent ? spanContextOf(parent) : undefined,
        startTime: input.startTime,
      }),
    );

    open.set(input.spanId, observation);
    return observation;
  };

  const end = (
    spanId: string,
    attributes: ObservationAttributes,
    timestamp: number,
  ): void => {
    const observation = open.get(spanId);
    if (!observation) {
      return;
    }
    updateSpan(observation, attributes);
    observation.end(new Date(timestamp));
    open.delete(spanId);
  };

  const unsubs = [
    events.on("agent.started", (event) => {
      begin({
        spanId: event.spanId,
        parentSpanId: event.parentSpanId,
        name: AGENT_SPAN_NAMES[event.role],
        type: "agent",
        attributes: {
          input: event.task,
          metadata: { model: event.model, role: event.role },
        },
        startTime: event.timestamp,
      });
    }),

    events.on("agent.completed", (event) => {
      const observation = open.get(event.spanId);

      if (event.role === "engineer") {
        lastVersion = event.outcome.version ?? lastVersion;
        end(event.spanId, { output: event.outcome }, event.timestamp);
        return;
      }

      // Puts the flag in the trace list, where a run can be found by result.
      observation?.setTraceIO({
        input: TASK_NAME,
        output: event.outcome.flag ?? event.outcome.summary,
      });

      const parent = observation ? spanContextOf(observation) : null;
      end(event.spanId, { output: event.outcome }, event.timestamp);

      if (!parent) {
        return;
      }

      // Trace tags are only settable while a span is being created, and the
      // outcome is unknown until now — hence one closing observation inside the
      // root's context, carrying the tags that make runs filterable.
      withTrace([...baseTags, event.outcome.ok ? "flag-found" : "no-flag"], () =>
        recordEvent({
          name: "run-outcome",
          parent,
          attributes: {
            output: event.outcome,
            metadata: { finalPromptVersion: lastVersion ?? "none" },
          },
        }),
      );
    }),

    events.on("agent.failed", (event) => {
      end(
        event.spanId,
        { level: "ERROR", statusMessage: event.error },
        event.timestamp,
      );
    }),

    events.on("generation.started", (event) => {
      begin({
        spanId: event.spanId,
        parentSpanId: event.parentSpanId,
        name: `${event.role} turn ${event.round}`,
        type: "generation",
        attributes: {
          input: event.messages,
          model: event.model,
          metadata: { round: event.round, role: event.role },
        },
        startTime: event.timestamp,
      });
    }),

    events.on("generation.completed", (event) => {
      const cost = estimateCost(event.role, event.usage);
      end(
        event.spanId,
        {
          output: event.output,
          usageDetails: {
            input: event.usage.inputTokens,
            input_cached_tokens: event.usage.cachedInputTokens,
            output: event.usage.outputTokens,
            total: event.usage.inputTokens + event.usage.outputTokens,
          },
          costDetails: {
            input: cost.input,
            output: cost.output,
            total: cost.total,
          },
        },
        event.timestamp,
      );
    }),

    events.on("generation.failed", (event) => {
      end(
        event.spanId,
        { level: "ERROR", statusMessage: event.error },
        event.timestamp,
      );
    }),

    events.on("tool.started", (event) => {
      begin({
        spanId: event.spanId,
        parentSpanId: event.parentSpanId,
        name: event.name,
        type: "tool",
        attributes: {
          input: event.arguments,
          metadata: { round: event.round, role: event.role },
        },
        startTime: event.timestamp,
      });
    }),

    events.on("tool.completed", (event) => {
      end(event.spanId, { output: event.output }, event.timestamp);
    }),

    events.on("tool.failed", (event) => {
      end(
        event.spanId,
        { level: "ERROR", statusMessage: event.error },
        event.timestamp,
      );
    }),
  ];

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }

    // Anything still open means the run was interrupted; close it as an error
    // so the trace is not left with dangling spans.
    for (const [spanId, observation] of open) {
      updateSpan(observation, {
        level: "ERROR",
        statusMessage: "run ended before this observation completed",
      });
      observation.end();
      open.delete(spanId);
    }
  };
}
