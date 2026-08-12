import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { chat, extractText, extractToolCalls } from "./api.js";
import { chatLog } from "./chat-log.js";
import { MAX_TOOL_ROUNDS } from "./config.js";
import { callMcpTool } from "./mcp/client.js";
import { buildSystemInstructions } from "./prompts/instructions.js";
import { appendItems, getHistory } from "./sessions.js";
import type { FunctionCallOutput } from "./sessions.js";
import type { AiFunctionCall, OpenAiFunctionTool } from "./types.js";

export type AgentMcpContext = {
  client: Client;
  tools: OpenAiFunctionTool[];
};

async function executeToolCalls(
  sessionID: string,
  client: Client,
  toolCalls: AiFunctionCall[],
): Promise<FunctionCallOutput[]> {
  return Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments) as Record<string, unknown>;
      chatLog.toolCall(sessionID, call.name, args);

      try {
        const result = await callMcpTool(client, call.name, args);
        chatLog.toolResult(sessionID, call.name, result);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        chatLog.toolError(sessionID, call.name, message);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify({ error: message }),
        };
      }
    }),
  );
}

export async function handleOperatorMessage(
  sessionID: string,
  msg: string,
  mcp: AgentMcpContext,
): Promise<string> {
  await appendItems(sessionID, [{ role: "user", content: msg }]);

  let conversation = [...getHistory(sessionID)];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (process.env.DEBUG) {
      chatLog.boot(`[${sessionID}] round ${round + 1}/${MAX_TOOL_ROUNDS}`);
    }

    const response = await chat({
      input: conversation,
      tools: mcp.tools,
      instructions: buildSystemInstructions(),
    });

    const toolCalls = extractToolCalls(response);
    if (toolCalls.length === 0) {
      const reply =
        extractText(response) ?? "Sorry, I could not generate a reply.";

      await appendItems(sessionID, [{ role: "assistant", content: reply }]);
      return reply;
    }

    const toolResults = await executeToolCalls(
      sessionID,
      mcp.client,
      toolCalls,
    );
    const updated = await appendItems(sessionID, [
      ...toolCalls,
      ...toolResults,
    ]);
    conversation = [...updated];
  }

  throw new Error(`Agent exceeded max tool rounds (${MAX_TOOL_ROUNDS})`);
}
