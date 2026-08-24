import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  FORCE_DOC_REFRESH,
  formatLessonPath,
  HUB_DOC_BASE_URL,
  SPK_DIR,
} from "./config.js";
import { log } from "./logger.js";


async function downloadSpkFile(fileName: string): Promise<string> {
  const localPath = path.join(SPK_DIR, fileName);

  if (!FORCE_DOC_REFRESH && (await Bun.file(localPath).exists())) {
    return localPath;
  }

  const url = new URL(fileName, HUB_DOC_BASE_URL).toString();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${fileName}: ${response.status} ${response.statusText}`,
    );
  }

  await mkdir(SPK_DIR, { recursive: true });

  const tempPath = `${localPath}.part`;

  try {
    const bytes = await Bun.write(tempPath, response);

    if (bytes === 0) {
      throw new Error(`Downloaded ${fileName} is empty`);
    }

    await rename(tempPath, localPath);
  } catch (error: unknown) {
    await rm(tempPath, { force: true });
    throw error;
  }

  log.data(`Downloaded ${formatLessonPath(localPath)}`);
  return localPath;
}

export function extractIncludes(markdown: string): string[] {
  const matches = markdown.matchAll(/\[include file="([^"]+)"\]/g);
  return [...matches].flatMap((match) => (match[1] ? [match[1]] : []));
}

export async function syncSpkDocumentation(): Promise<void> {
  const pending = ["index.md"];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const fileName = pending.shift();

    if (!fileName || seen.has(fileName)) {
      continue;
    }
    seen.add(fileName);

    const localPath = await downloadSpkFile(fileName);

    if (fileName.endsWith(".md")) {
      pending.push(...extractIncludes(await Bun.file(localPath).text()));
    }
  }

  log.info(`Documentation ready (${seen.size} files)`);
}
