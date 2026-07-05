const HUB_VERIFY_URL = "https://hub.ag3nts.org/verify";

export class HubVerifyError extends Error {
  /**
   * @param {{ status: number; code?: number; hubMessage: string; body: unknown }} params
   */
  constructor({ status, code, hubMessage, body }) {
    super(formatHubErrorMessage({ status, code, hubMessage }));
    this.name = "HubVerifyError";
    this.status = status;
    this.code = code;
    this.hubMessage = hubMessage;
    this.body = body;
  }
}

/**
 * @param {{ status: number; code?: number; hubMessage: string }} params
 */
const formatHubErrorMessage = ({ status, code, hubMessage }) => {
  const codeSuffix = code !== undefined ? ` [code ${code}]` : "";
  return `Hub verify failed (${status})${codeSuffix}: ${hubMessage}`;
};

const getHubApiKey = () => {
  const apikey = process.env.HUB_API_KEY?.trim();

  if (!apikey) {
    console.error("Error: HUB_API_KEY is not set");
    process.exit(1);
  }

  return apikey;
};

/**
 * @param {string} bodyText
 */
const parseHubBody = (bodyText) => {
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
};

/**
 * @param {unknown} data
 * @returns {{ code?: number; message: string } | null}
 */
const extractHubError = (data) => {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const message = "message" in data && typeof data.message === "string"
    ? data.message
    : null;

  if (!message) {
    return null;
  }

  const code = "code" in data && typeof data.code === "number"
    ? data.code
    : undefined;

  return { code, message };
};

/**
 * @param {unknown} response
 */
export const formatHubSuccess = (response) => {
  if (typeof response === "string") {
    return response;
  }

  if (typeof response === "object" && response !== null && "message" in response) {
    const message = response.message;
    return typeof message === "string" ? message : JSON.stringify(response);
  }

  return JSON.stringify(response, null, 2);
};

/**
 * @template Answer
 * @param {{ task: string; answer: Answer }} params
 */
export const submitAnswer = async ({ task, answer }) => {
  const response = await fetch(HUB_VERIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apikey: getHubApiKey(),
      task,
      answer,
    }),
  });

  const bodyText = await response.text();
  const data = parseHubBody(bodyText);

  if (!response.ok) {
    const hubError = extractHubError(data);

    throw new HubVerifyError({
      status: response.status,
      code: hubError?.code,
      hubMessage: hubError?.message ?? bodyText,
      body: data,
    });
  }

  return data;
};

export { HUB_VERIFY_URL };
