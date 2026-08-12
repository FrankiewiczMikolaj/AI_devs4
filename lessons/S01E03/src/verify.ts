import { formatHubSuccess, HubVerifyError, submitAnswer } from "../../../hub.js";
import { TASK_NAME } from "./config.js";
import { captureFlags } from "./flag.js";
import { log } from "./logger.js";

const url = process.argv[2]?.trim();
if (!url) {
  console.error("Usage: bun src/verify.ts https://your-public-url/");
  process.exit(1);
}

const sessionID = `hub-${Date.now()}`;

try {
  log.hub(`Submitting ${TASK_NAME} url=${url} sessionID=${sessionID}`);

  const response = await submitAnswer({
    task: TASK_NAME,
    answer: {
      url,
      sessionID,
    },
  });

  const message = formatHubSuccess(response);
  const flags = await captureFlags(message);
  if (flags.length === 0) {
    log.hub(`Response: ${message}`);
  }
} catch (error: unknown) {
  if (error instanceof HubVerifyError) {
    const code = error.code !== undefined ? ` (code ${error.code})` : "";
    log.hubError(`${error.hubMessage}${code}`);
    process.exit(1);
  }

  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
