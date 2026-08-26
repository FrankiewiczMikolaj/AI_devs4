import type { AgentEvent, AgentEventType } from "./types.js";

export type EventHandler<T extends AgentEvent = AgentEvent> = (event: T) => void;

export type AgentEventEmitter = {
  emit(event: AgentEvent): void;
  on<T extends AgentEventType>(
    type: T,
    handler: EventHandler<Extract<AgentEvent, { type: T }>>,
  ): () => void;
  onAny(handler: EventHandler): () => void;
};

export function createEventEmitter(): AgentEventEmitter {
  const handlers = new Map<string, Set<EventHandler>>();

  const getSet = (key: string): Set<EventHandler> => {
    let set = handlers.get(key);
    if (!set) {
      set = new Set();
      handlers.set(key, set);
    }
    return set;
  };

  const safeCall = (handler: EventHandler, event: AgentEvent): void => {
    try {
      handler(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[events] handler error on ${event.type}: ${message}`);
    }
  };

  return {
    emit(event) {
      for (const handler of getSet(event.type)) {
        safeCall(handler, event);
      }
      for (const handler of getSet("*")) {
        safeCall(handler, event);
      }
    },

    on(type, handler) {
      const set = getSet(type);
      set.add(handler as EventHandler);
      return () => {
        set.delete(handler as EventHandler);
      };
    },

    onAny(handler) {
      const set = getSet("*");
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
  };
}
