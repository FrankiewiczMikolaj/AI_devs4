import { formatHubSuccess, HubVerifyError, submitAnswer } from "../../../hub.js";
import { runFindHimAgent } from "./agent.js";
import { saveSubmittedAnswer } from "./answer.js";
import { TASK_NAME } from "./config.js";
import { log } from "./logger.js";
import { loadPowerPlants } from "./plants.js";
import { loadSuspects } from "./suspects.js";
import type { FindHimAnswer } from "./types.js";

async function solve(): Promise<FindHimAnswer> {
  const suspects = await loadSuspects();
  const plants = await loadPowerPlants();

  log.info(
    `Starting agent with ${suspects.length} suspects and ${plants.length} power plants`,
  );

  const answer = await runFindHimAgent({ suspects, plants });
  log.output(`Answer: ${JSON.stringify(answer)}`);

  log.hub("Submitting answer");
  const hubResponse = await submitAnswer({
    task: TASK_NAME,
    answer,
  });

  const message = formatHubSuccess(hubResponse);
  const hasFlag = message.includes("{FLG:");
  log.hub(hasFlag ? `🚩 ${message}` : `Response: ${message}`);

  if (hasFlag) {
    await saveSubmittedAnswer(answer);
  }

  return answer;
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
