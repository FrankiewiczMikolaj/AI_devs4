import { mkdir, readFile, writeFile } from "node:fs/promises";
import { FLAGS_PATH, OUTPUT_DIR, formatLessonPath } from "./config.js";
import { log } from "./logger.js";

type FlagRecord = {
  flag: string;
  sessionId: string;
  savedAt: string;
};

async function loadHistory(): Promise<FlagRecord[]> {
  try {
    const raw = await readFile(FLAGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is FlagRecord =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FlagRecord).flag === "string" &&
        typeof (item as FlagRecord).sessionId === "string" &&
        typeof (item as FlagRecord).savedAt === "string",
    );
  } catch {
    return [];
  }
}

export async function saveFlag(input: {
  flag: string;
  sessionId: string;
}): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const history = await loadHistory();
  if (history.some((entry) => entry.flag === input.flag)) {
    log.output(`flag already saved → ${formatLessonPath(FLAGS_PATH)}`);
    log.output(input.flag);
    return;
  }

  history.push({
    flag: input.flag,
    sessionId: input.sessionId,
    savedAt: new Date().toISOString(),
  });
  await writeFile(FLAGS_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf8");

  log.output(`flag saved → ${formatLessonPath(FLAGS_PATH)}`);
  log.output(input.flag);
}
