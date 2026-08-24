import path from "node:path";

export const TASK_NAME = "sendit";

export const AI_MODEL = "gpt-4.1";
export const VISION_MODEL = "gpt-4.1";

export const MAX_AGENT_ROUNDS = 80;

export const API_TIMEOUT_MS = 120_000;
export const API_MAX_ATTEMPTS = 3;
export const API_RETRY_BASE_DELAY_MS = 1_000;

export const HUB_DOC_BASE_URL = "https://hub.ag3nts.org/dane/doc/";

export const FORCE_DOC_REFRESH = process.env.S01E04_REFRESH_DOCS === "1";

const LESSON_ROOT = path.join(import.meta.dir, "..");

export const WORKSPACE_DIR = path.join(LESSON_ROOT, "workspace");
export const SPK_DIR = path.join(WORKSPACE_DIR, "spk");
export const OUTPUT_DIR = path.join(WORKSPACE_DIR, "output");
export const DECLARATION_PATH = path.join(OUTPUT_DIR, "declaration.txt");

export function formatLessonPath(filePath: string): string {
  return path.relative(LESSON_ROOT, filePath).split(path.sep).join("/");
}

export const SPK_RELATIVE_PATH = `${formatLessonPath(SPK_DIR)}/`;
export const DECLARATION_RELATIVE_PATH = formatLessonPath(DECLARATION_PATH);
