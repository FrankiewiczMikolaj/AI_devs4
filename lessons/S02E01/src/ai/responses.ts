import type {
  AiResponse,
  ConversationItem,
  FunctionCall,
  OutputItem,
  OutputMessage,
  ToolCallOutput,
} from "./types.js";

const MAX_TRACED_CHARS = 2_000;

function isFunctionCall(item: OutputItem): item is FunctionCall {
  return item.type === "function_call";
}

function isOutputMessage(item: OutputItem): item is OutputMessage {
  return item.type === "message";
}

function isToolCallOutput(item: ConversationItem): item is ToolCallOutput {
  return "type" in item && item.type === "function_call_output" && "output" in item;
}

function messageText(item: OutputMessage): string {
  return (
    item.content?.find((part) => part.type === "output_text")?.text?.trim() ?? ""
  );
}

function truncate(text: string): string {
  return text.length > MAX_TRACED_CHARS
    ? `${text.slice(0, MAX_TRACED_CHARS)}… (${text.length} chars)`
    : text;
}

export function extractToolCalls(response: AiResponse): FunctionCall[] {
  return (response.output ?? []).filter(isFunctionCall);
}

export function extractText(response: AiResponse): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const message = (response.output ?? []).find(isOutputMessage);
  const text = message ? messageText(message) : "";
  return text || null;
}

export type TracedMessage = { role: string; content: string };

/** Conversation rendered as chat messages so Langfuse can display the prompt. */
export function toTracedMessages(
  instructions: string,
  items: ConversationItem[],
): TracedMessage[] {
  const messages: TracedMessage[] = [
    { role: "system", content: truncate(instructions) },
  ];

  for (const item of items) {
    if ("role" in item && item.role === "user") {
      messages.push({ role: "user", content: truncate(item.content) });
      continue;
    }

    if (isToolCallOutput(item)) {
      messages.push({ role: "tool", content: truncate(item.output) });
      continue;
    }

    if (!("type" in item)) {
      continue;
    }

    if (isFunctionCall(item)) {
      messages.push({
        role: "assistant",
        content: truncate(`${item.name}(${item.arguments})`),
      });
      continue;
    }

    if (isOutputMessage(item)) {
      const text = messageText(item);
      if (text) {
        messages.push({ role: "assistant", content: truncate(text) });
      }
    }
  }

  return messages;
}

/** Model output reduced to what is worth reading in a trace or a log line. */
export function summarizeOutput(response: AiResponse): unknown {
  const items: unknown[] = [];

  for (const item of response.output ?? []) {
    if (isFunctionCall(item)) {
      items.push({ tool: item.name, arguments: item.arguments });
      continue;
    }

    if (isOutputMessage(item)) {
      const text = messageText(item);
      if (text) {
        items.push({ text: truncate(text) });
      }
    }
  }

  return items.length === 1 ? items[0] : items;
}
