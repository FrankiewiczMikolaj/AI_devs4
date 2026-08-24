import path, { extname } from "node:path";

const LESSON_ROOT = path.join(import.meta.dir, "../..");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function resolveMimeType(filePath: string): string {
  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()];

  if (!mimeType) {
    throw new Error(
      `Not an image file: ${filePath}. Supported extensions: ${Object.keys(MIME_TYPES).join(", ")}`,
    );
  }

  return mimeType;
}

export function resolveLessonPath(filePath: string): string {
  const absolute = path.resolve(LESSON_ROOT, filePath);

  if (
    absolute !== LESSON_ROOT &&
    !absolute.startsWith(LESSON_ROOT + path.sep)
  ) {
    throw new Error(`Path leaves the lesson directory: ${filePath}`);
  }

  return absolute;
}

export async function readImageAsBase64(filePath: string): Promise<string> {
  const file = Bun.file(resolveLessonPath(filePath));
  return Buffer.from(await file.arrayBuffer()).toString("base64");
}
