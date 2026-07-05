import {
  AI_API_KEY,
  AI_PROVIDER,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../../../config.js";
import { AI_MODEL } from "./config.js";
import type { AiResponse } from "./types.js";

type StructuredChatParams = {
  input: string;
  textFormat: unknown;
};

export async function chatStructured({
  input,
  textFormat,
}: StructuredChatParams): Promise<AiResponse> {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
      ...EXTRA_API_HEADERS,
    },
    body: JSON.stringify({
      model: resolveModelForProvider(AI_MODEL),
      input: [{ role: "user", content: input }],
      text: { format: textFormat },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as AiResponse;

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
}

export function extractText(response: AiResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const messages = response.output?.filter((item) => item.type === "message") ?? [];

  const text = messages
    .flatMap((message) => message.content ?? [])
    .find((part) => part.type === "output_text")?.text;

  if (!text) {
    const types = response.output?.map((item) => item.type).join(", ") || "none";
    throw new Error(`No output_text in AI response. Found output types: ${types}`);
  }

  return text;
}

export function extractJson<T>(response: AiResponse, label = "response"): T {
  const text = extractText(response);

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const preview = text.length > 200 ? `${text.slice(0, 200)}...` : text;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON for ${label}: ${message}\nOutput: ${preview}`);
  }
}

export function getAiProviderLabel(): string {
  return AI_PROVIDER === "openrouter" ? "OpenRouter" : "OpenAI";
}
