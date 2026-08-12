import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SESSIONS_DIR } from "./config.js";
import type { AiFunctionCall } from "./types.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FunctionCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export type ConversationItem = ChatMessage | AiFunctionCall | FunctionCallOutput;

const store = new Map<string, ConversationItem[]>();

/** Sanitize sessionID for use as a filename (alphanumeric, underscore, dash). */
function sessionFileName(sessionID: string): string {
  const safe = sessionID.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safe || "unknown"}.json`;
}

/** Wipe session files from the previous run, then ensure the directory exists. */
export async function resetSessions(): Promise<void> {
  await rm(SESSIONS_DIR, { recursive: true, force: true });
  await mkdir(SESSIONS_DIR, { recursive: true });
  store.clear();
}

export function getHistory(sessionID: string): ConversationItem[] {
  return store.get(sessionID) ?? [];
}

/** Append one or more conversation items and persist to disk. */
export async function appendItems(
  sessionID: string,
  items: ConversationItem[],
): Promise<ConversationItem[]> {
  const history = getHistory(sessionID);
  history.push(...items);
  store.set(sessionID, history);
  await persist(sessionID, history);
  return history;
}

async function persist(
  sessionID: string,
  history: ConversationItem[],
): Promise<void> {
  const filePath = path.join(SESSIONS_DIR, sessionFileName(sessionID));
  await writeFile(filePath, JSON.stringify(history, null, 2), "utf8");
}
