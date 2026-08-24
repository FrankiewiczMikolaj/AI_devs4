import {
  AI_API_KEY,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../../../config.js";
import {
  AI_MODEL,
  API_MAX_ATTEMPTS,
  API_RETRY_BASE_DELAY_MS,
  API_TIMEOUT_MS,
} from "./config.js";
import { log } from "./logger.js";
import type {
  AiFunctionCall,
  AiOutputMessage,
  AiResponse,
  ApiUsageTotals,
  ConversationItem,
} from "./types.js";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const usageTotals: ApiUsageTotals = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
};

export function getApiUsage(): ApiUsageTotals {
  return { ...usageTotals };
}

function recordUsage(response: AiResponse): void {
  usageTotals.requests += 1;
  usageTotals.inputTokens += response.usage?.input_tokens ?? 0;
  usageTotals.outputTokens += response.usage?.output_tokens ?? 0;
  usageTotals.totalTokens += response.usage?.total_tokens ?? 0;
}

class TransientApiError extends Error {}

type ChatParams = {
  input: ConversationItem[];
  tools?: unknown[];
  toolChoice?: "auto" | "none" | "required";
  instructions?: string;
};

function parseJsonBody(bodyText: string): AiResponse {
  try {
    return JSON.parse(bodyText) as AiResponse;
  } catch {
    return {};
  }
}

async function attemptRequest(
  body: Record<string, unknown>,
): Promise<AiResponse> {
  let response: Response;

  try {
    response = await fetch(RESPONSES_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
        ...EXTRA_API_HEADERS,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TransientApiError(`AI API request failed: ${reason}`);
  }

  const bodyText = await response.text();
  const data = parseJsonBody(bodyText);

  if (response.ok && !data.error) {
    return data;
  }

  const message =
    data.error?.message ??
    `AI API error ${response.status}: ${bodyText.slice(0, 200)}`;

  if (RETRYABLE_STATUS.has(response.status)) {
    throw new TransientApiError(message);
  }

  throw new Error(message);
}

export async function callResponsesApi(
  body: Record<string, unknown>,
): Promise<AiResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await attemptRequest(body);
      recordUsage(response);
      return response;
    } catch (error: unknown) {
      if (!(error instanceof TransientApiError) || attempt >= API_MAX_ATTEMPTS) {
        throw error;
      }

      const delayMs = API_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      log.info(
        `${error.message} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${API_MAX_ATTEMPTS})`,
      );
      await Bun.sleep(delayMs);
    }
  }
}

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

  return callResponsesApi(body);
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
    (item): item is AiOutputMessage => item.type === "message",
  );

  const text = message?.content?.find((part) => part.type === "output_text")
    ?.text;

  return text?.trim() ? text : null;
}
