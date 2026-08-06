import path from "node:path";

export const TASK_NAME = "findhim";

export const AI_MODEL = "gpt-4.1-mini";
export const MAX_TOOL_ROUNDS = 10;

const LESSON_ROOT = path.join(import.meta.dir, "..");

export const DATA_DIR = path.join(LESSON_ROOT, "data");
export const CACHE_DIR = path.join(LESSON_ROOT, "cache");
export const OUTPUT_DIR = path.join(LESSON_ROOT, "output");
export const SUSPECTS_PATH = path.join(DATA_DIR, "suspects.json");
export const LOCATIONS_PATH = path.join(DATA_DIR, "findhim_locations.json");
export const GEOCODE_CACHE_PATH = path.join(CACHE_DIR, "geocode.json");
export const SUBMITTED_ANSWER_PATH = path.join(OUTPUT_DIR, "answer.json");

export function formatLessonPath(filePath: string): string {
  return path.relative(LESSON_ROOT, filePath).split(path.sep).join("/");
}

export const CLI_FORCE = process.argv.includes("--force");

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}
