import type { TracedMessage } from "../ai/responses.js";
import type { AgentOutcome, RoleId } from "../agent/types.js";

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/**
 * Started/completed pairs carry a `spanId` so a subscriber can open an
 * observation when the work begins and close it when it ends. `parentSpanId`
 * gives the nesting: engineer agent under the `delegate` tool that started it.
 */
export type AgentEvent =
  | {
      type: "agent.started";
      spanId: string;
      parentSpanId: string | null;
      role: RoleId;
      model: string;
      task: string;
      timestamp: number;
    }
  | {
      type: "agent.completed";
      spanId: string;
      role: RoleId;
      outcome: AgentOutcome;
      timestamp: number;
    }
  | {
      type: "agent.failed";
      spanId: string;
      role: RoleId;
      error: string;
      timestamp: number;
    }
  | {
      type: "generation.started";
      spanId: string;
      parentSpanId: string;
      role: RoleId;
      round: number;
      model: string;
      messages: TracedMessage[];
      timestamp: number;
    }
  | {
      type: "generation.completed";
      spanId: string;
      role: RoleId;
      round: number;
      output: unknown;
      usage: TokenUsage;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "generation.failed";
      spanId: string;
      role: RoleId;
      round: number;
      error: string;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "tool.started";
      spanId: string;
      parentSpanId: string;
      role: RoleId;
      round: number;
      name: string;
      arguments: Record<string, unknown>;
      timestamp: number;
    }
  | {
      type: "tool.completed";
      spanId: string;
      role: RoleId;
      name: string;
      output: unknown;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "tool.failed";
      spanId: string;
      role: RoleId;
      name: string;
      error: string;
      durationMs: number;
      timestamp: number;
    }
  | {
      type: "hub.attempt";
      index: number;
      total: number;
      itemId: string;
      accepted: boolean;
      flag: string | null;
      status: number;
      message: string;
      timestamp: number;
    };

export type AgentEventType = AgentEvent["type"];

type Handler = (event: AgentEvent) => void;

export type AgentEvents = {
  emit(event: AgentEvent): void;
  on<T extends AgentEventType>(
    type: T,
    handler: (event: Extract<AgentEvent, { type: T }>) => void,
  ): () => void;
  onAny(handler: Handler): () => void;
};

const ANY = "*";

let spanCounter = 0;

export function nextSpanId(): string {
  spanCounter += 1;
  return `span-${spanCounter}`;
}

export function createEvents(): AgentEvents {
  const handlers = new Map<string, Set<Handler>>();

  const bucket = (key: string): Set<Handler> => {
    const existing = handlers.get(key);
    if (existing) {
      return existing;
    }
    const created = new Set<Handler>();
    handlers.set(key, created);
    return created;
  };

  const call = (handler: Handler, event: AgentEvent): void => {
    try {
      handler(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[events] handler error on ${event.type}: ${message}`);
    }
  };

  return {
    emit(event) {
      for (const handler of bucket(event.type)) {
        call(handler, event);
      }
      for (const handler of bucket(ANY)) {
        call(handler, event);
      }
    },

    on(type, handler) {
      const set = bucket(type);
      set.add(handler as Handler);
      return () => {
        set.delete(handler as Handler);
      };
    },

    onAny(handler) {
      const set = bucket(ANY);
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
  };
}
