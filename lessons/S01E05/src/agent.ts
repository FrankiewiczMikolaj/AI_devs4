import { chat, extractText, extractToolCalls } from "./api.js";
import { AI_MODEL, MAX_AGENT_ROUNDS } from "./config.js";
import type { AgentEventEmitter } from "./events/index.js";
import { log } from "./logger.js";
import {
  executeNativeTool,
  isNativeTool,
  nativeTools,
} from "./native/tools.js";
import { buildAgentInstructions } from "./prompts/instructions.js";
import { buildTaskMessage } from "./prompts/task.js";
import type {
  AiFunctionCall,
  AiOutputItem,
  AiOutputMessage,
  ConversationItem,
  RailwayToolResult,
  ToolOutput,
} from "./types.js";

type ToolExecution = {
  output: ToolOutput;
  flag: string | null;
};

export type AgentRun = {
  ok: boolean;
  rounds: number;
  flag: string | null;
  summary: string;
};

function readFlag(result: unknown): string | null {
  if (typeof result !== "object" || result === null) {
    return null;
  }

  const flag = (result as RailwayToolResult).flag;
  return typeof flag === "string" ? flag : null;
}

function isFunctionCall(item: AiOutputItem): item is AiFunctionCall {
  return item.type === "function_call";
}

function isOutputMessage(item: AiOutputItem): item is AiOutputMessage {
  return item.type === "message";
}

function summarizeGenerationOutput(output: AiOutputItem[]): unknown {
  return output.map((item) => {
    if (isFunctionCall(item)) {
      return {
        type: item.type,
        name: item.name,
        arguments: item.arguments,
      };
    }

    if (isOutputMessage(item)) {
      const text = item.content?.find((part) => part.type === "output_text")
        ?.text;
      return {
        type: item.type,
        text: text ? text.slice(0, 240) : undefined,
      };
    }

    return { type: item.type };
  });
}

function summarizeToolOutput(result: unknown): unknown {
  if (typeof result !== "object" || result === null) {
    return result;
  }

  const toolResult = result as RailwayToolResult;

  return {
    status: toolResult.status,
    ok: toolResult.ok,
    attempts: toolResult.attempts,
    waitedMs: toolResult.waitedMs,
    flag: toolResult.flag,
    body: toolResult.body,
  };
}

async function executeToolCall(
  call: AiFunctionCall,
  input: {
    events: AgentEventEmitter;
    sessionId: string;
    round: number;
  },
): Promise<ToolExecution> {
  const toOutput = (payload: unknown): ToolOutput => ({
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify(payload),
  });

  let args: Record<string, unknown> = {};
  const startTime = Date.now();

  try {
    args = JSON.parse(call.arguments) as Record<string, unknown>;

    if (!isNativeTool(call.name)) {
      throw new Error(`Unknown tool: ${call.name}`);
    }

    const result = await executeNativeTool(call.name, args);

    input.events.emit({
      type: "tool.completed",
      sessionId: input.sessionId,
      round: input.round,
      name: call.name,
      arguments: args,
      output: summarizeToolOutput(result),
      durationMs: Date.now() - startTime,
      startTime,
      timestamp: Date.now(),
    });

    return {
      output: toOutput(result),
      flag: readFlag(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.data(`✗ ${call.name}: ${message}`);

    input.events.emit({
      type: "tool.failed",
      sessionId: input.sessionId,
      round: input.round,
      name: call.name,
      arguments: args,
      error: message,
      durationMs: Date.now() - startTime,
      startTime,
      timestamp: Date.now(),
    });

    return { output: toOutput({ error: message }), flag: null };
  }
}

async function executeToolCalls(
  calls: AiFunctionCall[],
  input: {
    events: AgentEventEmitter;
    sessionId: string;
    round: number;
  },
): Promise<ToolExecution[]> {
  const executions: ToolExecution[] = [];

  for (const call of calls) {
    executions.push(await executeToolCall(call, input));
  }

  return executions;
}

export async function runAgent(input: {
  events: AgentEventEmitter;
  sessionId: string;
}): Promise<AgentRun> {
  const instructions = buildAgentInstructions();
  const task = buildTaskMessage();
  const conversation: ConversationItem[] = [
    { role: "user", content: task },
  ];

  input.events.emit({
    type: "agent.started",
    sessionId: input.sessionId,
    task,
    model: AI_MODEL,
    timestamp: Date.now(),
  });

  try {
    for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
      input.events.emit({
        type: "turn.started",
        sessionId: input.sessionId,
        round,
        timestamp: Date.now(),
      });

      const generationStarted = Date.now();
      const response = await chat({
        input: conversation,
        tools: nativeTools,
        toolChoice: "required",
        instructions,
      });

      const outputItems = response.output ?? [];

      input.events.emit({
        type: "generation.completed",
        sessionId: input.sessionId,
        round,
        model: AI_MODEL,
        input: { conversationItems: conversation.length },
        output: summarizeGenerationOutput(outputItems),
        usage: response.usage
          ? {
              inputTokens: response.usage.input_tokens ?? 0,
              outputTokens: response.usage.output_tokens ?? 0,
              totalTokens: response.usage.total_tokens ?? 0,
            }
          : undefined,
        durationMs: Date.now() - generationStarted,
        startTime: generationStarted,
        timestamp: Date.now(),
      });

      conversation.push(...outputItems);

      const toolCalls = extractToolCalls(response);
      if (toolCalls.length === 0) {
        const summary =
          extractText(response) ?? "Agent stopped without using a tool";
        const result: AgentRun = {
          ok: false,
          rounds: round,
          flag: null,
          summary,
        };
        input.events.emit({
          type: "agent.completed",
          sessionId: input.sessionId,
          ...result,
          timestamp: Date.now(),
        });
        return result;
      }

      const executions = await executeToolCalls(toolCalls, {
        events: input.events,
        sessionId: input.sessionId,
        round,
      });
      conversation.push(...executions.map((execution) => execution.output));

      const flag = executions.find((execution) => execution.flag)?.flag ?? null;
      if (flag) {
        const result: AgentRun = {
          ok: true,
          rounds: round,
          flag,
          summary: flag,
        };
        input.events.emit({
          type: "agent.completed",
          sessionId: input.sessionId,
          ...result,
          timestamp: Date.now(),
        });
        return result;
      }
    }

    const result: AgentRun = {
      ok: false,
      rounds: MAX_AGENT_ROUNDS,
      flag: null,
      summary: `Agent hit the limit of ${MAX_AGENT_ROUNDS} rounds`,
    };
    input.events.emit({
      type: "agent.completed",
      sessionId: input.sessionId,
      ...result,
      timestamp: Date.now(),
    });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    input.events.emit({
      type: "agent.failed",
      sessionId: input.sessionId,
      error: message,
      timestamp: Date.now(),
    });
    throw error;
  }
}
