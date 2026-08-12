import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../../../config.js";
import { AI_MODEL } from "./config.js";
import type { AiFunctionCall, AiResponse } from "./types.js";

type ChatParams = {
  input: unknown[];
  tools?: unknown[];
  toolChoice?: "auto" | "none" | "required";
  instructions?: string;
};

export async function chat({
  input,
  tools,
  toolChoice = "auto",
  instructions,
}: ChatParams): Promise<AiResponse> {
  const body: Record<string, unknown> = {
    model: resolveModelForProvider(AI_MODEL),
    input,
  };

  if (tools) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  if (instructions) {
    body.instructions = instructions;
  }

  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as AiResponse;

  if (!response.ok || data.error) {
    const message = data.error?.message ?? `AI API error: ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function extractToolCalls(response: AiResponse): AiFunctionCall[] {
  return (response.output ?? []).filter(
    (item): item is AiFunctionCall => item.type === "function_call",
  );
}

export function extractText(response: AiResponse): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const message = response.output?.find(
    (item): item is Extract<NonNullable<AiResponse["output"]>[number], { type: "message" }> =>
      item.type === "message",
  );

  if (!message) {
    return null;
  }

  const text = message.content?.find((part) => part.type === "output_text")?.text;
  return text?.trim() ? text : null;
}
