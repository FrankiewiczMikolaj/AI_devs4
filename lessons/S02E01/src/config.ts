import path from "node:path";

export const TASK_NAME = "categorize";

export const ROOT_MODEL = "gpt-4.1";
export const ENGINEER_MODEL = "anthropic/claude-sonnet-4-6";

/** USD per 1M tokens, used for the run summary and Langfuse cost details. */
export const MODEL_PRICE_PER_1M = {
  root: { input: 2.0, cachedInput: 0.5, output: 8.0 },
  engineer: { input: 3.0, cachedInput: 0.3, output: 15.0 },
} as const;

export const MAX_ROOT_ROUNDS = 12;
export const MAX_ENGINEER_ROUNDS = 8;
export const MAX_PROMPT_TOKENS = 100;

export const MAX_REPEATED_TOOL_FAILURES = 3;
export const MAX_CONSECUTIVE_TOOL_FAILURES = 5;

export const AI_TIMEOUT_MS = 120_000;
export const AI_MAX_ATTEMPTS = 3;
export const AI_RETRY_BASE_DELAY_MS = 1_000;

export const HUB_TIMEOUT_MS = 30_000;
export const HUB_MAX_ATTEMPTS = 3;
export const HUB_RETRY_BASE_DELAY_MS = 2_000;

export const RUN_LOG_ENABLED = process.env.S02E01_RUN_LOG === "1";

export const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
export const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY?.trim() ?? "";
export const LANGFUSE_BASE_URL =
  process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";

const LESSON_ROOT = path.join(import.meta.dir, "..");

const WORKSPACE_DIR = path.join(LESSON_ROOT, "workspace");
export const OUTPUT_DIR = path.join(WORKSPACE_DIR, "output");
export const RUNS_DIR = path.join(WORKSPACE_DIR, "runs");
export const PROMPTS_DIR = path.join(WORKSPACE_DIR, "prompts");
export const FLAGS_PATH = path.join(OUTPUT_DIR, "flags.json");

export function formatLessonPath(filePath: string): string {
  return path.relative(LESSON_ROOT, filePath).split(path.sep).join("/");
}
