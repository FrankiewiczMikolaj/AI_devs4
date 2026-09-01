import { mkdir, readFile, writeFile } from "node:fs/promises";
import { FLAGS_PATH, formatLessonPath, OUTPUT_DIR } from "../config.js";

type FlagRecord = {
  flag: string;
  sessionId: string;
  savedAt: string;
};

function isFlagRecord(value: unknown): value is FlagRecord {
  const record = value as FlagRecord | null;
  return (
    typeof record === "object" &&
    record !== null &&
    typeof record.flag === "string" &&
    typeof record.sessionId === "string" &&
    typeof record.savedAt === "string"
  );
}

async function loadHistory(): Promise<FlagRecord[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(FLAGS_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isFlagRecord) : [];
  } catch {
    return [];
  }
}

export async function saveFlag(input: {
  flag: string;
  sessionId: string;
}): Promise<string> {
  const history = await loadHistory();

  if (history.some((entry) => entry.flag === input.flag)) {
    return `flag already in ${formatLessonPath(FLAGS_PATH)}`;
  }

  history.push({
    flag: input.flag,
    sessionId: input.sessionId,
    savedAt: new Date().toISOString(),
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(FLAGS_PATH, `${JSON.stringify(history, null, 2)}\n`, "utf8");

  return `flag → ${formatLessonPath(FLAGS_PATH)}`;
}
