import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chatLog } from "./chat-log.js";
import { FLAGS_PATH, OUTPUT_DIR } from "./config.js";

const FLAG_RE = /\{FLG:[^}]+\}/g;

const printedFlags = new Set<string>();

export function extractFlags(text: string): string[] {
  return text.match(FLAG_RE) ?? [];
}

async function loadSavedFlags(): Promise<string[]> {
  try {
    const raw = await readFile(FLAGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

async function saveFlags(flags: string[]): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(FLAGS_PATH, `${JSON.stringify(flags, null, 2)}\n`, "utf8");
}

export async function captureFlags(text: string): Promise<string[]> {
  const found = extractFlags(text);
  if (found.length === 0) {
    return [];
  }

  const uniqueFound = [...new Set(found)];
  const saved = await loadSavedFlags();
  const savedSet = new Set(saved);

  const toPersist: string[] = [];
  for (const flag of uniqueFound) {
    if (!printedFlags.has(flag)) {
      printedFlags.add(flag);
      chatLog.flag(flag);
    }
    if (!savedSet.has(flag)) {
      savedSet.add(flag);
      toPersist.push(flag);
    }
  }

  if (toPersist.length > 0) {
    await saveFlags([...saved, ...toPersist]);
  }

  return toPersist;
}
