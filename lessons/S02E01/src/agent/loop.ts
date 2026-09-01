import type { AiClient } from "../ai/client.js";
import {
  extractText,
  extractToolCalls,
  summarizeOutput,
  toTracedMessages,
} from "../ai/responses.js";
import type { ConversationItem, FunctionCall } from "../ai/types.js";
import {
  MAX_CONSECUTIVE_TOOL_FAILURES,
  MAX_REPEATED_TOOL_FAILURES,
} from "../config.js";
import { nextSpanId } from "../observability/events.js";
import type { AgentEvents } from "../observability/events.js";
import type { ToolContext } from "../tools/types.js";
import type { AgentOutcome, AgentRole, CompletionSignal } from "./types.js";

export type ToolRunner = (
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>;

export type RunAgentInput = {
  role: AgentRole;
  ai: AiClient;
  events: AgentEvents;
  runTool: ToolRunner;
  toolContext: Omit<ToolContext, "role" | "spanId">;
  parentSpanId?: string | null;
};

type ToolResult = {
  output: ConversationItem;
  completion: CompletionSignal | null;
  failure: { key: string; message: string } | null;
};

/** Counts identical and back-to-back tool failures to stop a stuck agent. */
class FailureBudget {
  private readonly repeats = new Map<string, number>();
  private consecutive = 0;

  /** Returns a reason to abort, or null when the agent may continue. */
  record(failure: { key: string; message: string } | null): string | null {
    if (!failure) {
      this.consecutive = 0;
      return null;
    }

    this.consecutive += 1;
    const repeats = (this.repeats.get(failure.key) ?? 0) + 1;
    this.repeats.set(failure.key, repeats);

    if (repeats >= MAX_REPEATED_TOOL_FAILURES) {
      return `the same tool call failed ${repeats}× with: ${failure.message}`;
    }

    if (this.consecutive >= MAX_CONSECUTIVE_TOOL_FAILURES) {
      return `${this.consecutive} tool calls failed in a row, last one: ${failure.message}`;
    }

    return null;
  }
}

async function executeToolCall(
  call: FunctionCall,
  input: {
    role: AgentRole;
    events: AgentEvents;
    runTool: ToolRunner;
    toolContext: Omit<ToolContext, "role" | "spanId">;
    agentSpanId: string;
    round: number;
  },
): Promise<ToolResult> {
  const spanId = nextSpanId();
  const startedAt = Date.now();
  let args: Record<string, unknown> = {};

  const toConversationItem = (payload: unknown): ConversationItem => ({
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify(payload),
  });

  try {
    args = JSON.parse(call.arguments) as Record<string, unknown>;

    input.events.emit({
      type: "tool.started",
      spanId,
      parentSpanId: input.agentSpanId,
      role: input.role.id,
      round: input.round,
      name: call.name,
      arguments: args,
      timestamp: startedAt,
    });

    const result = await input.runTool(call.name, args, {
      ...input.toolContext,
      role: input.role.id,
      spanId,
    });

    input.events.emit({
      type: "tool.completed",
      spanId,
      role: input.role.id,
      name: call.name,
      output: result,
      durationMs: Date.now() - startedAt,
      timestamp: Date.now(),
    });

    return {
      output: toConversationItem(result),
      completion: input.role.completion(call.name, result),
      failure: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    input.events.emit({
      type: "tool.failed",
      spanId,
      role: input.role.id,
      name: call.name,
      error: message,
      durationMs: Date.now() - startedAt,
      timestamp: Date.now(),
    });

    return {
      output: toConversationItem({ error: message }),
      completion: null,
      failure: { key: `${call.name}:${message}`, message },
    };
  }
}

async function generate(
  input: RunAgentInput & { agentSpanId: string; round: number },
  conversation: ConversationItem[],
) {
  const spanId = nextSpanId();
  const startedAt = Date.now();

  input.events.emit({
    type: "generation.started",
    spanId,
    parentSpanId: input.agentSpanId,
    role: input.role.id,
    round: input.round,
    model: input.role.model,
    messages: toTracedMessages(input.role.instructions, conversation),
    timestamp: startedAt,
  });

  try {
    const response = await input.ai.respond({
      role: input.role.id,
      model: input.role.model,
      instructions: input.role.instructions,
      input: conversation,
      tools: input.role.tools,
    });

    input.events.emit({
      type: "generation.completed",
      spanId,
      role: input.role.id,
      round: input.round,
      output: summarizeOutput(response),
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        cachedInputTokens:
          response.usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
      durationMs: Date.now() - startedAt,
      timestamp: Date.now(),
    });

    return response;
  } catch (error: unknown) {
    input.events.emit({
      type: "generation.failed",
      spanId,
      role: input.role.id,
      round: input.round,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      timestamp: Date.now(),
    });
    throw error;
  }
}

/**
 * The one agent loop in this lesson. Both the orchestrator and the prompt
 * engineer are the same machine driven by a different `AgentRole`.
 */
export async function runAgent(input: RunAgentInput): Promise<AgentOutcome> {
  const { role, events } = input;
  const agentSpanId = nextSpanId();
  const conversation: ConversationItem[] = [
    { role: "user", content: role.task },
  ];
  const failures = new FailureBudget();

  events.emit({
    type: "agent.started",
    spanId: agentSpanId,
    parentSpanId: input.parentSpanId ?? null,
    role: role.id,
    model: role.model,
    task: role.task,
    timestamp: Date.now(),
  });

  const finish = (outcome: AgentOutcome): AgentOutcome => {
    events.emit({
      type: "agent.completed",
      spanId: agentSpanId,
      role: role.id,
      outcome,
      timestamp: Date.now(),
    });
    return outcome;
  };

  try {
    for (let round = 1; round <= role.maxRounds; round++) {
      const response = await generate(
        { ...input, agentSpanId, round },
        conversation,
      );
      conversation.push(...(response.output ?? []));

      const toolCalls = extractToolCalls(response);
      if (toolCalls.length === 0) {
        // tool_choice is "required", so this means the model refused to act.
        return finish({
          ok: false,
          rounds: round,
          summary: extractText(response) ?? "the model answered without a tool call",
          flag: null,
          version: null,
        });
      }

      for (const call of toolCalls) {
        const result = await executeToolCall(call, {
          role,
          events,
          runTool: input.runTool,
          toolContext: input.toolContext,
          agentSpanId,
          round,
        });
        conversation.push(result.output);

        const abortReason = failures.record(result.failure);
        if (abortReason) {
          return finish({
            ok: false,
            rounds: round,
            summary: `aborted because ${abortReason}`,
            flag: null,
            version: null,
          });
        }

        if (result.completion) {
          return finish({
            ok: result.completion.ok,
            rounds: round,
            summary: result.completion.summary,
            flag: result.completion.flag ?? null,
            version: result.completion.version ?? null,
          });
        }
      }
    }

    return finish({
      ok: false,
      rounds: role.maxRounds,
      summary: `hit the limit of ${role.maxRounds} rounds`,
      flag: null,
      version: null,
    });
  } catch (error: unknown) {
    events.emit({
      type: "agent.failed",
      spanId: agentSpanId,
      role: role.id,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    });
    throw error;
  }
}
