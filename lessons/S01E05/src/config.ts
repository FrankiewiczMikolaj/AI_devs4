import path from "node:path";

export const TASK_NAME = "railway";

export const TARGET_ROUTE = "X-01";

export const AI_MODEL = "gpt-4.1";
export const MODEL_PRICE_PER_1M = {
  input: 2.0,
  output: 8.0,
} as const;

export const MAX_AGENT_ROUNDS = 40;

export const API_TIMEOUT_MS = 120_000;
export const API_MAX_ATTEMPTS = 3;
export const API_RETRY_BASE_DELAY_MS = 1_000;

export const RAILWAY_TIMEOUT_MS = 30_000;
export const RAILWAY_MAX_ATTEMPTS = 20;
export const RAILWAY_503_BASE_DELAY_MS = 1_000;
export const RAILWAY_RETRY_AFTER_BUFFER_MS = 750;

export const RUN_LOG_ENABLED = process.env.S01E05_RUN_LOG === "1";

export const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
export const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY?.trim() ?? "";
export const LANGFUSE_BASE_URL =
  process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";

const LESSON_ROOT = path.join(import.meta.dir, "..");

export const WORKSPACE_DIR = path.join(LESSON_ROOT, "workspace");
export const OUTPUT_DIR = path.join(WORKSPACE_DIR, "output");
export const RUNS_DIR = path.join(WORKSPACE_DIR, "runs");
export const FLAGS_PATH = path.join(OUTPUT_DIR, "flags.json");

export function formatLessonPath(filePath: string): string {
  return path.relative(LESSON_ROOT, filePath).split(path.sep).join("/");
}
