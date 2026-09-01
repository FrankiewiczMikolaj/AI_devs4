import {
  AI_API_KEY,
  AI_PROVIDER,
  EXTRA_API_HEADERS,
  RESPONSES_API_ENDPOINT,
  resolveModelForProvider,
} from "../../../../config.js";
import {
  AI_MAX_ATTEMPTS,
  AI_RETRY_BASE_DELAY_MS,
  AI_TIMEOUT_MS,
} from "../config.js";
import type { RoleId } from "../agent/types.js";
import { log } from "../logger.js";
import type {
  AiResponse,
  ConversationItem,
  FunctionToolSchema,
  TokenTotals,
} from "./types.js";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export type ChatRequest = {
  role: RoleId;
  model: string;
  instructions: string;
  input: ConversationItem[];
  tools: FunctionToolSchema[];
};

export type AiClient = {
  respond(request: ChatRequest): Promise<AiResponse>;
};

export type MeteredAiClient = AiClient & {
  usage(): Record<RoleId, TokenTotals>;
};

class TransientAiError extends Error {}

export function describeModel(model: string): string {
  return `${resolveModelForProvider(model)} (${AI_PROVIDER})`;
}

function parseBody(bodyText: string): AiResponse {
  try {
    return JSON.parse(bodyText) as AiResponse;
  } catch {
    return {};
  }
}

async function attempt(body: Record<string, unknown>): Promise<AiResponse> {
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new TransientAiError(`AI request failed: ${reason}`);
  }

  const bodyText = await response.text();
  const data = parseBody(bodyText);

  if (response.ok && !data.error) {
    return data;
  }

  const message =
    data.error?.message ??
    `AI API error ${response.status}: ${bodyText.slice(0, 200)}`;

  if (RETRYABLE_STATUS.has(response.status)) {
    throw new TransientAiError(message);
  }

  throw new Error(message);
}

function emptyTotals(): TokenTotals {
  return { requests: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
}

export function createAiClient(): MeteredAiClient {
  const totals: Record<RoleId, TokenTotals> = {
    root: emptyTotals(),
    engineer: emptyTotals(),
  };

  return {
    async respond(request) {
      const body: Record<string, unknown> = {
        model: resolveModelForProvider(request.model),
        instructions: request.instructions,
        input: request.input,
        tools: request.tools,
        tool_choice: "required",
      };

      for (let attemptNo = 1; ; attemptNo++) {
        try {
          const response = await attempt(body);
          const bucket = totals[request.role];
          bucket.requests += 1;
          bucket.inputTokens += response.usage?.input_tokens ?? 0;
          bucket.cachedInputTokens +=
            response.usage?.input_tokens_details?.cached_tokens ?? 0;
          bucket.outputTokens += response.usage?.output_tokens ?? 0;
          return response;
        } catch (error: unknown) {
          if (
            !(error instanceof TransientAiError) ||
            attemptNo >= AI_MAX_ATTEMPTS
          ) {
            throw error;
          }

          const delayMs = AI_RETRY_BASE_DELAY_MS * 2 ** (attemptNo - 1);
          log.info(
            `${error.message} — retrying in ${delayMs}ms (attempt ${attemptNo + 1}/${AI_MAX_ATTEMPTS})`,
          );
          await Bun.sleep(delayMs);
        }
      }
    },

    usage() {
      return { root: { ...totals.root }, engineer: { ...totals.engineer } };
    },
  };
}
