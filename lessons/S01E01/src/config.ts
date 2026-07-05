import path from "node:path";
import type { JobTag } from "./schemas/job-tags.js";

export const TASK_NAME = "people";

export const REFERENCE_YEAR = 2026;
export const MIN_AGE = 20;
export const MAX_AGE = 40;
export const MIN_BIRTH_YEAR = REFERENCE_YEAR - MAX_AGE;
export const MAX_BIRTH_YEAR = REFERENCE_YEAR - MIN_AGE;

export const TARGET_GENDER = "M";
export const TARGET_CITY = "Grudziądz";
export const REQUIRED_TAG: JobTag = "transport";

export const AI_MODEL = "gpt-4.1-mini";

export const DATA_DIR = path.join(import.meta.dir, "..", "data");
export const CACHE_DIR = path.join(import.meta.dir, "..", "cache");
export const OUTPUT_DIR = path.join(import.meta.dir, "..", "output");
export const CSV_PATH = path.join(DATA_DIR, "people.csv");
export const TAGGING_CACHE_PATH = path.join(CACHE_DIR, "tagged.json");
export const SUBMITTED_SUSPECTS_PATH = path.join(OUTPUT_DIR, "suspects.json");

export const CLI_FORCE = process.argv.includes("--force");

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}
