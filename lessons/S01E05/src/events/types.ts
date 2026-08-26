export type AgentEvent =
  | {
      type: "agent.started";
      sessionId: string;
      task: string;
      model: string;
      timestamp: number;
    }
  | {
      type: "agent.completed";
      sessionId: string;
      ok: boolean;
      rounds: number;
      flag: string | null;
      summary: string;
      timestamp: number;
    }
  | {
      type: "agent.failed";
      sessionId: string;
      error: string;
      timestamp: number;
    }
  | {
      type: "turn.started";
      sessionId: string;
      round: number;
      timestamp: number;
    }
  | {
      type: "generation.completed";
      sessionId: string;
      round: number;
      model: string;
      input: unknown;
      output: unknown;
      usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      durationMs: number;
      startTime: number;
      timestamp: number;
    }
  | {
      type: "tool.completed";
      sessionId: string;
      round: number;
      name: string;
      arguments: Record<string, unknown>;
      output: unknown;
      durationMs: number;
      startTime: number;
      timestamp: number;
    }
  | {
      type: "tool.failed";
      sessionId: string;
      round: number;
      name: string;
      arguments: Record<string, unknown>;
      error: string;
      durationMs: number;
      startTime: number;
      timestamp: number;
    };

export type AgentEventType = AgentEvent["type"];
