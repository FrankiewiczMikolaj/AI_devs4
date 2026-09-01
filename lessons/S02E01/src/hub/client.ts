import { HUB_VERIFY_URL } from "../../../../hub.js";
import {
  HUB_MAX_ATTEMPTS,
  HUB_RETRY_BASE_DELAY_MS,
  HUB_TIMEOUT_MS,
  TASK_NAME,
} from "../config.js";
import { log } from "../logger.js";
import { parseItemsCsv } from "./items.js";
import { parseHubReply } from "./response.js";
import type { CsvItems, HubReply, HubUsage } from "./types.js";

const CSV_URL_TEMPLATE = "https://hub.ag3nts.org/data/{apikey}/categorize.csv";
const RETRYABLE_CSV_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export type HubClient = {
  fetchItems(): Promise<CsvItems>;
  classify(prompt: string): Promise<HubReply>;
  reset(): Promise<HubReply>;
  usage(): HubUsage;
};

function requireApiKey(): string {
  const apikey = process.env.HUB_API_KEY?.trim();
  if (!apikey) {
    throw new Error("HUB_API_KEY is not set");
  }
  return apikey;
}

function parseJson(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText;
  }
}

function readRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null;
}

async function downloadCsv(): Promise<string> {
  const url = CSV_URL_TEMPLATE.replace(
    "{apikey}",
    encodeURIComponent(requireApiKey()),
  );

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    });

    if (response.ok) {
      return response.text();
    }

    if (
      !RETRYABLE_CSV_STATUS.has(response.status) ||
      attempt >= HUB_MAX_ATTEMPTS
    ) {
      throw new Error(`Failed to fetch categorize.csv (${response.status})`);
    }

    const delayMs =
      readRetryAfterMs(response) ?? HUB_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    log.info(
      `categorize.csv ${response.status} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${HUB_MAX_ATTEMPTS})`,
    );
    await Bun.sleep(delayMs);
  }
}

export function createHubClient(): HubClient {
  const usage: HubUsage = { classifyRequests: 0, resets: 0 };

  const postVerify = async (prompt: string): Promise<HubReply> => {
    const response = await fetch(HUB_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: requireApiKey(),
        task: TASK_NAME,
        answer: { prompt },
      }),
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    });

    return parseHubReply({
      status: response.status,
      httpOk: response.ok,
      body: parseJson(await response.text()),
    });
  };

  return {
    async fetchItems() {
      return parseItemsCsv(await downloadCsv());
    },

    async classify(prompt) {
      usage.classifyRequests += 1;
      return postVerify(prompt);
    },

    async reset() {
      usage.resets += 1;
      return postVerify("reset");
    },

    usage() {
      return { ...usage };
    },
  };
}
