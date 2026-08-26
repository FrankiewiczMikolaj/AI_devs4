import { HUB_VERIFY_URL } from "../../../../hub.js";
import {
  RAILWAY_503_BASE_DELAY_MS,
  RAILWAY_MAX_ATTEMPTS,
  RAILWAY_RETRY_AFTER_BUFFER_MS,
  RAILWAY_TIMEOUT_MS,
  TASK_NAME,
} from "../config.js";
import { log } from "../logger.js";

export type RailwayAction = {
  action: string;
  route?: string;
  value?: string;
};

export type RailwayResponse = {
  status: number;
  ok: boolean;
  body: unknown;
  headers: Record<string, string>;
  attempts: number;
  waitedMs: number;
};

export type RailwayUsage = {
  requests: number;
  overload503: number;
  rateLimited429: number;
  waitedMs: number;
};

const usage: RailwayUsage = {
  requests: 0,
  overload503: 0,
  rateLimited429: 0,
  waitedMs: 0,
};

export function getRailwayUsage(): RailwayUsage {
  return { ...usage };
}

export function readRetryAfterSeconds(body: unknown): number | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  if (!("retry_after" in body)) {
    return null;
  }

  const value = (body as { retry_after: unknown }).retry_after;

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function getHubApiKey(): string {
  const apikey = process.env.HUB_API_KEY?.trim();

  if (!apikey) {
    throw new Error("HUB_API_KEY is not set");
  }

  return apikey;
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });

  return result;
}

function parseBody(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText;
  }
}

function buildAnswer(action: RailwayAction): Record<string, string> {
  const answer: Record<string, string> = { action: action.action };

  if (action.route !== undefined) {
    answer.route = action.route;
  }

  if (action.value !== undefined) {
    answer.value = action.value;
  }

  return answer;
}

async function sleepTracked(delayMs: number): Promise<void> {
  usage.waitedMs += delayMs;
  await Bun.sleep(delayMs);
}

async function postOnce(action: RailwayAction): Promise<{
  status: number;
  ok: boolean;
  body: unknown;
  headers: Record<string, string>;
}> {
  const response = await fetch(HUB_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: getHubApiKey(),
      task: TASK_NAME,
      answer: buildAnswer(action),
    }),
    signal: AbortSignal.timeout(RAILWAY_TIMEOUT_MS),
  });

  const bodyText = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    body: parseBody(bodyText),
    headers: headersToObject(response.headers),
  };
}

export async function callRailway(
  action: RailwayAction,
): Promise<RailwayResponse> {
  let waitedMs = 0;

  for (let attempt = 1; ; attempt++) {
    usage.requests += 1;

    let result: Awaited<ReturnType<typeof postOnce>>;

    try {
      result = await postOnce(action);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      if (attempt >= RAILWAY_MAX_ATTEMPTS) {
        throw new Error(
          `Railway request failed after ${attempt} attempts: ${message}`,
        );
      }

      const delayMs = RAILWAY_503_BASE_DELAY_MS * 2 ** (attempt - 1);
      log.hub(
        `network error: ${message} — retry in ${delayMs}ms (${attempt}/${RAILWAY_MAX_ATTEMPTS})`,
      );
      await sleepTracked(delayMs);
      waitedMs += delayMs;
      continue;
    }

    if (result.status === 503) {
      usage.overload503 += 1;

      if (attempt >= RAILWAY_MAX_ATTEMPTS) {
        return { ...result, attempts: attempt, waitedMs };
      }

      const delayMs = RAILWAY_503_BASE_DELAY_MS * 2 ** (attempt - 1);
      log.hub(
        `503 overload — retry in ${delayMs}ms (${attempt}/${RAILWAY_MAX_ATTEMPTS})`,
      );
      await sleepTracked(delayMs);
      waitedMs += delayMs;
      continue;
    }

    if (result.status === 429) {
      usage.rateLimited429 += 1;

      if (attempt >= RAILWAY_MAX_ATTEMPTS) {
        return { ...result, attempts: attempt, waitedMs };
      }

      const retryAfter = readRetryAfterSeconds(result.body);
      const delayMs =
        retryAfter === null
          ? RAILWAY_503_BASE_DELAY_MS * 2 ** (attempt - 1)
          : Math.ceil(retryAfter * 1000) + RAILWAY_RETRY_AFTER_BUFFER_MS;

      log.hub(
        `429 rate limit — waiting ${Math.ceil(delayMs / 1000)}s` +
          (retryAfter === null ? "" : ` (retry_after=${retryAfter})`) +
          ` (${attempt}/${RAILWAY_MAX_ATTEMPTS})`,
      );
      await sleepTracked(delayMs);
      waitedMs += delayMs;
      continue;
    }

    return { ...result, attempts: attempt, waitedMs };
  }
}
