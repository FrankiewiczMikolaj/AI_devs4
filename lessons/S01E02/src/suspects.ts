import { formatLessonPath, SUSPECTS_PATH } from "./config.js";
import { log } from "./logger.js";
import type { Suspect } from "./types.js";

export async function loadSuspects(): Promise<Suspect[]> {
  const file = Bun.file(SUSPECTS_PATH);

  if (!(await file.exists())) {
    throw new Error(`Suspects file not found: ${formatLessonPath(SUSPECTS_PATH)}`);
  }

  const suspects = (await file.json()) as Suspect[];
  log.data(`Loaded ${suspects.length} suspects from ${formatLessonPath(SUSPECTS_PATH)}`);
  return suspects;
}