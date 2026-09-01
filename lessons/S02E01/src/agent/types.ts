import type { FunctionToolSchema } from "../ai/types.js";

export type RoleId = "root" | "engineer";

export type AgentOutcome = {
  ok: boolean;
  rounds: number;
  summary: string;
  flag: string | null;
  version: string | null;
};

export type CompletionSignal = {
  ok: boolean;
  summary: string;
  flag?: string | null;
  version?: string | null;
};

export type AgentRole = {
  id: RoleId;
  model: string;
  instructions: string;
  task: string;
  tools: FunctionToolSchema[];
  maxRounds: number;
  completion: (toolName: string, result: unknown) => CompletionSignal | null;
};
