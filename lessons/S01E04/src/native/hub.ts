import {
  formatHubSuccess,
  HubVerifyError,
  submitAnswer,
} from "../../../../hub.js";
import { DECLARATION_RELATIVE_PATH, TASK_NAME } from "../config.js";
import { readDeclaration } from "../declaration.js";
import { log } from "../logger.js";

export type HubSubmitResult = {
  ok: boolean;
  message: string;
  code?: number;
};

export async function submitDeclarationToHub(): Promise<HubSubmitResult> {
  const declaration = await readDeclaration();

  if (!declaration) {
    return { ok: false, message: `${DECLARATION_RELATIVE_PATH} is empty` };
  }

  log.hub(`Submitting ${TASK_NAME}`);

  try {
    const response = await submitAnswer({
      task: TASK_NAME,
      answer: { declaration },
    });

    const message = formatHubSuccess(response);
    log.hub(message);

    return { ok: true, message };
  } catch (error: unknown) {
    if (error instanceof HubVerifyError) {
      log.hubError(
        error.code === undefined
          ? error.hubMessage
          : `${error.hubMessage} (code ${error.code})`,
      );

      return { ok: false, message: error.hubMessage, code: error.code };
    }

    throw error;
  }
}
