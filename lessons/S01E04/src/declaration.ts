import { mkdir, rm } from "node:fs/promises";
import { DECLARATION_PATH, OUTPUT_DIR } from "./config.js";

export async function resetDeclaration(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await rm(DECLARATION_PATH, { force: true });
}

export async function readDeclaration(): Promise<string> {
  const file = Bun.file(DECLARATION_PATH);

  if (!(await file.exists())) {
    return "";
  }

  return (await file.text()).trim();
}
