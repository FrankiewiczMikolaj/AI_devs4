import { mkdir } from "node:fs/promises";
import { chatStructured, extractJson, getAiProviderLabel } from "./api.js";
import { CLI_FORCE, DATA_DIR, TAGGING_CACHE_PATH } from "./config.js";
import { log } from "./logger.js";
import { buildJobTaggingPrompt } from "./prompts/job-tagging.js";
import { jobTaggingSchema } from "./schemas/job-tagging.js";
import type { JobTaggingResult, Suspect, SuspectInput } from "./types.js";

function toSuspectInput(suspects: Suspect[]): SuspectInput[] {
  return suspects.map(({ id, job }) => ({ id, job }));
}

function isValidCache(cached: JobTaggingResult, suspectCount: number): boolean {
  return cached.suspects.length === suspectCount;
}

async function readTaggingCache(suspectCount: number): Promise<JobTaggingResult | null> {
  const cacheFile = Bun.file(TAGGING_CACHE_PATH);

  if (!(await cacheFile.exists())) {
    return null;
  }

  const cached = (await cacheFile.json()) as JobTaggingResult;

  if (!isValidCache(cached, suspectCount)) {
    log.cache("Tagging cache is stale, refreshing...");
    return null;
  }

  return cached;
}

async function writeTaggingCache(result: JobTaggingResult): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await Bun.write(TAGGING_CACHE_PATH, JSON.stringify(result, null, 2));
}

export async function tagSuspects(suspects: Suspect[]): Promise<JobTaggingResult> {
  if (!CLI_FORCE) {
    const cached = await readTaggingCache(suspects.length);

    if (cached) {
      log.cache(`Using tagging result from ${TAGGING_CACHE_PATH}`);
      return cached;
    }
  } else {
    log.cache("--force set, skipping tagging cache");
  }

  const suspectInputs = toSuspectInput(suspects);
  const prompt = buildJobTaggingPrompt(suspectInputs);

  log.info(`Tagging ${suspectInputs.length} suspects with ${getAiProviderLabel()}...`);

  const response = await chatStructured({
    input: prompt,
    textFormat: jobTaggingSchema,
  });

  const result = extractJson<JobTaggingResult>(response);
  await writeTaggingCache(result);

  log.cache(`Tagging result saved to ${TAGGING_CACHE_PATH}`);

  return result;
}
