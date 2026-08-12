import path from "node:path";

export const TASK_NAME = "proxy";
export const AI_MODEL = "gpt-4.1";
export const MAX_TOOL_ROUNDS = 5;
export const PORT = 3000;

const LESSON_ROOT = path.join(import.meta.dir, "..");

export const SESSIONS_DIR = path.join(LESSON_ROOT, "sessions");
export const OUTPUT_DIR = path.join(LESSON_ROOT, "output");
export const FLAGS_PATH = path.join(OUTPUT_DIR, "flags.json");

export function formatLessonPath(filePath: string): string {
  return path.relative(LESSON_ROOT, filePath).split(path.sep).join("/");
}
