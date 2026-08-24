import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { chat, extractText, extractToolCalls } from "./api.js";
import { MAX_AGENT_ROUNDS } from "./config.js";
import { log } from "./logger.js";
import { callMcpTool, mcpToolsToOpenAI } from "./mcp/client.js";
import type { HubSubmitResult } from "./native/hub.js";
import {
  executeNativeTool,
  isNativeTool,
  nativeTools,
} from "./native/tools.js";
import { buildAgentInstructions } from "./prompts/instructions.js";
import { buildTaskMessage } from "./prompts/task.js";
import type {
  AiFunctionCall,
  ConversationItem,
  McpToolDefinition,
  ToolOutput,
} from "./types.js";

const SUBMIT_TOOL = "submit_declaration";

type ToolExecution = {
  output: ToolOutput;
  submitResult?: HubSubmitResult;
};

export type AgentRun = {
  accepted: boolean;
  rounds: number;
  summary: string;
};

function readSubmitResult(
  name: string,
  result: unknown,
): HubSubmitResult | undefined {
  if (name !== SUBMIT_TOOL || typeof result !== "object" || result === null) {
    return undefined;
  }

  return result as HubSubmitResult;
}

async function executeToolCall(
  mcpClient: Client,
  call: AiFunctionCall,
): Promise<ToolExecution> {
  const toOutput = (payload: unknown): ToolOutput => ({
    type: "function_call_output",
    call_id: call.call_id,
    output: JSON.stringify(payload),
  });

  try {
    const args = JSON.parse(call.arguments) as Record<string, unknown>;
    log.data(`→ ${call.name}(${JSON.stringify(args)})`);

    const result = isNativeTool(call.name)
      ? await executeNativeTool(call.name, args)
      : await callMcpTool(mcpClient, call.name, args);

    log.data(`✓ ${call.name}`);

    return {
      output: toOutput(result),
      submitResult: readSubmitResult(call.name, result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.data(`✗ ${call.name}: ${message}`);

    return { output: toOutput({ error: message }) };
  }
}

async function executeToolCalls(
  mcpClient: Client,
  calls: AiFunctionCall[],
): Promise<ToolExecution[]> {
  const executions = new Map<string, ToolExecution>();

  await Promise.all(
    calls
      .filter((call) => call.name !== SUBMIT_TOOL)
      .map(async (call) => {
        executions.set(call.call_id, await executeToolCall(mcpClient, call));
      }),
  );

  for (const call of calls.filter((call) => call.name === SUBMIT_TOOL)) {
    executions.set(call.call_id, await executeToolCall(mcpClient, call));
  }

  return calls.flatMap((call) => {
    const execution = executions.get(call.call_id);
    return execution ? [execution] : [];
  });
}

export async function runAgent(input: {
  mcpClient: Client;
  mcpTools: McpToolDefinition[];
}): Promise<AgentRun> {
  const tools = [...mcpToolsToOpenAI(input.mcpTools), ...nativeTools];
  const instructions = buildAgentInstructions();
  const conversation: ConversationItem[] = [
    { role: "user", content: buildTaskMessage() },
  ];

  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    log.info(`Round ${round}/${MAX_AGENT_ROUNDS}`);

    const response = await chat({
      input: conversation,
      tools,
      toolChoice: "required",
      instructions,
    });
    conversation.push(...(response.output ?? []));

    const toolCalls = extractToolCalls(response);
    if (toolCalls.length === 0) {
      return {
        accepted: false,
        rounds: round,
        summary: extractText(response) ?? "Agent stopped without using a tool",
      };
    }

    const executions = await executeToolCalls(input.mcpClient, toolCalls);
    conversation.push(...executions.map((execution) => execution.output));

    const accepted = executions.find(
      (execution) => execution.submitResult?.ok,
    )?.submitResult;

    if (accepted) {
      return { accepted: true, rounds: round, summary: accepted.message };
    }
  }

  return {
    accepted: false,
    rounds: MAX_AGENT_ROUNDS,
    summary: `Agent hit the limit of ${MAX_AGENT_ROUNDS} rounds`,
  };
}
