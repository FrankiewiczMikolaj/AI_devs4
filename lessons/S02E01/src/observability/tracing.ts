import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startObservation } from "@langfuse/tracing";
import type {
  LangfuseAgent,
  LangfuseGeneration,
  LangfuseGenerationAttributes,
  LangfuseTool,
} from "@langfuse/tracing";
import type { SpanContext } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  LANGFUSE_BASE_URL,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
  TASK_NAME,
} from "../config.js";
import { log } from "../logger.js";

export type ObservationType = "agent" | "generation" | "tool";

export type Observation = LangfuseAgent | LangfuseGeneration | LangfuseTool;

/** Generation attributes are the widest set, so they cover every span kind here. */
export type ObservationAttributes = LangfuseGenerationAttributes;

let sdk: NodeSDK | undefined;

export function isTracingEnabled(): boolean {
  return Boolean(LANGFUSE_PUBLIC_KEY && LANGFUSE_SECRET_KEY);
}

export function initTracing(): void {
  if (!isTracingEnabled()) {
    log.info(
      "langfuse disabled — set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable",
    );
    return;
  }

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_SECRET_KEY,
        baseUrl: LANGFUSE_BASE_URL,
      }),
    ],
    resource: resourceFromAttributes({ "service.name": `s02e01-${TASK_NAME}` }),
    autoDetectResources: false,
  });
  sdk.start();

  log.info(`langfuse tracing enabled (${LANGFUSE_BASE_URL})`);
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    log.info("langfuse tracing flushed");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.info(`langfuse shutdown error: ${message}`);
  }
}

export function spanContextOf(observation: Observation): SpanContext {
  return observation.otelSpan.spanContext();
}

export function startSpan(input: {
  name: string;
  type: ObservationType;
  attributes: ObservationAttributes;
  parent?: SpanContext;
  startTime: number;
}): Observation {
  const options = {
    parentSpanContext: input.parent,
    startTime: new Date(input.startTime),
  };

  switch (input.type) {
    case "generation":
      return startObservation(input.name, input.attributes, {
        ...options,
        asType: "generation",
      });
    case "tool":
      return startObservation(input.name, input.attributes, {
        ...options,
        asType: "tool",
      });
    default:
      return startObservation(input.name, input.attributes, {
        ...options,
        asType: "agent",
      });
  }
}

/** `update` on the observation union needs one concrete attribute type. */
export function updateSpan(
  observation: Observation,
  attributes: ObservationAttributes,
): void {
  observation.update(attributes);
}

/** Point-in-time observation; Langfuse ends it on creation. */
export function recordEvent(input: {
  name: string;
  attributes: ObservationAttributes;
  parent: SpanContext;
}): void {
  startObservation(input.name, input.attributes, {
    parentSpanContext: input.parent,
    asType: "event",
  });
}
