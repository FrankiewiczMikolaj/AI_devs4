export type AiProvider = "openai" | "openrouter";

export const AI_PROVIDER: AiProvider;
export const AI_API_KEY: string;
export const RESPONSES_API_ENDPOINT: string;
export const EXTRA_API_HEADERS: Record<string, string>;
export const resolveModelForProvider: (model: string) => string;
