const RESPONSES_ENDPOINTS = {
  openai: "https://api.openai.com/v1/responses",
  openrouter: "https://openrouter.ai/api/v1/responses",
};

const VALID_PROVIDERS = new Set(["openai", "openrouter"]);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() ?? "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim() ?? "";
const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";

const hasOpenAiKey = Boolean(OPENAI_API_KEY);
const hasOpenRouterKey = Boolean(OPENROUTER_API_KEY);

if (requestedProvider && !VALID_PROVIDERS.has(requestedProvider)) {
  console.error("Error: AI_PROVIDER must be one of: openai, openrouter");
  process.exit(1);
}

const resolveProvider = () => {
  if (requestedProvider) {
    if (requestedProvider === "openai" && !hasOpenAiKey) {
      console.error("Error: AI_PROVIDER=openai requires OPENAI_API_KEY");
      process.exit(1);
    }

    if (requestedProvider === "openrouter" && !hasOpenRouterKey) {
      console.error("Error: AI_PROVIDER=openrouter requires OPENROUTER_API_KEY");
      process.exit(1);
    }

    return requestedProvider;
  }

  if (hasOpenAiKey) return "openai";
  if (hasOpenRouterKey) return "openrouter";

  console.error("Error: Set OPENAI_API_KEY or OPENROUTER_API_KEY (optionally AI_PROVIDER)");
  process.exit(1);
};

/** @type {"openai" | "openrouter"} */
export const AI_PROVIDER = resolveProvider();

export const AI_API_KEY = AI_PROVIDER === "openai" ? OPENAI_API_KEY : OPENROUTER_API_KEY;
export const RESPONSES_API_ENDPOINT = RESPONSES_ENDPOINTS[AI_PROVIDER];

export const EXTRA_API_HEADERS = AI_PROVIDER === "openrouter"
  ? {
      ...(process.env.OPENROUTER_HTTP_REFERER
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
        : {}),
      ...(process.env.OPENROUTER_APP_NAME
        ? { "X-Title": process.env.OPENROUTER_APP_NAME }
        : {}),
    }
  : {};

/**
 * Prefixes bare OpenAI model names for OpenRouter (e.g. gpt-4.1-mini -> openai/gpt-4.1-mini).
 * @param {string} model
 */
export const resolveModelForProvider = (model) => {
  if (typeof model !== "string" || !model.trim()) {
    throw new Error("Model must be a non-empty string");
  }

  if (AI_PROVIDER !== "openrouter" || model.includes("/")) {
    return model;
  }

  return `openai/${model}`;
};
