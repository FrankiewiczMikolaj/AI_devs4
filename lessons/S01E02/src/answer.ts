import { mkdir } from "node:fs/promises";
import { formatLessonPath, OUTPUT_DIR, SUBMITTED_ANSWER_PATH } from "./config.js";
import { log } from "./logger.js";
import type { FindHimAnswer } from "./types.js";

export async function saveSubmittedAnswer(answer: FindHimAnswer): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await Bun.write(SUBMITTED_ANSWER_PATH, JSON.stringify(answer, null, 2));
  log.output(`Saved answer to ${formatLessonPath(SUBMITTED_ANSWER_PATH)}`);
}
