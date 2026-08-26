import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startObservation } from "@langfuse/tracing";
import type { SpanContext } from "@opentelemetry/api";
import {
  LANGFUSE_BASE_URL,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
} from "../config.js";
import { log } from "../logger.js";

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

  const processor = new LangfuseSpanProcessor({
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
    baseUrl: LANGFUSE_BASE_URL,
  });

  sdk = new NodeSDK({
    spanProcessors: [processor],
    resource: resourceFromAttributes({ "service.name": "s01e05-railway" }),
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

export type { SpanContext };

export function getSpanContext(
  obs?: { otelSpan: { spanContext(): SpanContext } },
): SpanContext | undefined {
  return obs?.otelSpan.spanContext();
}

export function traceAgent(
  name: string,
  opts: {
    input?: unknown;
    metadata?: Record<string, unknown>;
    parentSpanContext?: SpanContext;
    startTime?: Date;
  },
) {
  if (!isTracingEnabled()) {
    return undefined;
  }

  return startObservation(
    name,
    { input: opts.input, metadata: opts.metadata },
    {
      asType: "agent",
      parentSpanContext: opts.parentSpanContext,
      startTime: opts.startTime,
    },
  );
}

export function traceGeneration(
  name: string,
  opts: {
    model: string;
    input?: unknown;
    metadata?: Record<string, unknown>;
    parentSpanContext?: SpanContext;
    startTime?: Date;
  },
) {
  if (!isTracingEnabled()) {
    return undefined;
  }

  return startObservation(
    name,
    {
      input: opts.input,
      model: opts.model,
      metadata: opts.metadata,
    },
    {
      asType: "generation",
      parentSpanContext: opts.parentSpanContext,
      startTime: opts.startTime,
    },
  );
}

export function traceTool(
  name: string,
  opts: {
    input?: unknown;
    metadata?: Record<string, unknown>;
    parentSpanContext?: SpanContext;
    startTime?: Date;
  },
) {
  if (!isTracingEnabled()) {
    return undefined;
  }

  return startObservation(
    name,
    { input: opts.input, metadata: opts.metadata },
    {
      asType: "tool",
      parentSpanContext: opts.parentSpanContext,
      startTime: opts.startTime,
    },
  );
}
