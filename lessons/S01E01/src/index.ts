import { formatHubSuccess, HubVerifyError, submitAnswer } from "../../../hub.js";
import { REQUIRED_TAG, TASK_NAME } from "./config.js";
import { log } from "./logger.js";
import {
  downloadPeopleCsv,
  filterByRequiredTag,
  filterSuspects,
  loadPeople,
  saveSubmittedSuspects,
  toTaggedPeople,
} from "./people.js";
import { tagSuspects } from "./tagging.js";
import type { TaggedPerson } from "./types.js";

async function solve(): Promise<TaggedPerson[]> {
  const csvPath = await downloadPeopleCsv();
  const people = await loadPeople(csvPath);
  const suspects = filterSuspects(people);

  log.info(`Found ${suspects.length} suspects`);

  const taggingResult = await tagSuspects(suspects);
  const taggedPeople = toTaggedPeople(suspects, taggingResult);
  const finalAnswer = filterByRequiredTag(taggedPeople);

  log.info(`${finalAnswer.length} of ${taggedPeople.length} suspects match tag "${REQUIRED_TAG}"`);

  log.hub(`Submitting answer (task: ${TASK_NAME}, count: ${finalAnswer.length})...`);
  const hubResponse = await submitAnswer({
    task: TASK_NAME,
    answer: finalAnswer,
  });

  const message = formatHubSuccess(hubResponse);
  const hasFlag = message.includes("{FLG:");
  log.hub(hasFlag ? `🚩 ${message}` : `Response: ${message}`);

  if (hasFlag) {
    await saveSubmittedSuspects(finalAnswer);
  }

  return finalAnswer;
}

async function main(): Promise<void> {
  await solve();
}

main().catch((error: unknown) => {
  if (error instanceof HubVerifyError) {
    const code = error.code !== undefined ? ` (code ${error.code})` : "";
    log.hubError(`${error.hubMessage}${code}`);
    process.exit(1);
  }

  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
