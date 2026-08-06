import { chat, extractText, extractToolCalls } from "./api.js";
import { MAX_TOOL_ROUNDS } from "./config.js";
import { log } from "./logger.js";
import {
  buildAgentInstructions,
  buildAgentUserMessage,
} from "./prompts/instructions.js";
import { handlers, tools } from "./tools/index.js";
import type { AiFunctionCall, FindHimAnswer, PowerPlant, Suspect } from "./types.js";

function parseFindHimAnswer(text: string): FindHimAnswer {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Agent did not return JSON answer. Output: ${text.slice(0, 300)}`);
  }

  const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<FindHimAnswer>;

  if (
    typeof parsed.name !== "string" ||
    !parsed.name.trim() ||
    typeof parsed.surname !== "string" ||
    !parsed.surname.trim() ||
    typeof parsed.accessLevel !== "number" ||
    typeof parsed.powerPlant !== "string" ||
    !parsed.powerPlant.trim()
  ) {
    throw new Error(`Invalid FindHimAnswer shape: ${text.slice(0, 300)}`);
  }

  return {
    name: parsed.name,
    surname: parsed.surname,
    accessLevel: parsed.accessLevel,
    powerPlant: parsed.powerPlant,
  };
}

async function executeToolCalls(toolCalls: AiFunctionCall[]) {
  log.info(`Tool calls: ${toolCalls.length}`);

  return Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.arguments) as Record<string, unknown>;
      log.data(`→ ${call.name}(${JSON.stringify(args)})`);

      try {
        const handler = handlers[call.name];
        if (!handler) {
          throw new Error(`Unknown tool: ${call.name}`);
        }

        const result = await handler(args);
        log.data(`✓ ${call.name}`);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify(result),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.data(`✗ ${call.name}: ${message}`);
        return {
          type: "function_call_output" as const,
          call_id: call.call_id,
          output: JSON.stringify({ error: message }),
        };
      }
    }),
  );
}

export async function runFindHimAgent(input: {
  suspects: Suspect[];
  plants: PowerPlant[];
}): Promise<FindHimAnswer> {
  const instructions = buildAgentInstructions();
  const userMessage = buildAgentUserMessage(input);

  let conversation: unknown[] = [{ role: "user", content: userMessage }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    log.info(`Agent round ${round + 1}/${MAX_TOOL_ROUNDS}`);

    const response = await chat({
      input: conversation,
      tools: [...tools],
      instructions,
    });

    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      const text = extractText(response);
      if (!text) {
        throw new Error("Agent finished without text output");
      }

      return parseFindHimAnswer(text);
    }

    const toolResults = await executeToolCalls(toolCalls);
    conversation = [...conversation, ...toolCalls, ...toolResults];
  }

  throw new Error(`Agent exceeded max tool rounds (${MAX_TOOL_ROUNDS})`);
}
