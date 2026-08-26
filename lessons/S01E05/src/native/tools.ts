import type { OpenAiFunctionTool, RailwayToolResult } from "../types.js";
import { callRailway } from "./railway.js";

const FLAG_PATTERN = /\{FLG:[^}]+\}/;

export function extractFlag(value: unknown): string | null {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const match = FLAG_PATTERN.exec(text);
  return match?.[0] ?? null;
}

export const nativeTools: OpenAiFunctionTool[] = [
  {
    type: "function",
    name: "railway_api",
    description:
      "Call the railway route-control API. The API is self-documenting: use action \"help\" to learn available actions, required parameters, and allowed values. Pass only parameters that the documentation says are needed for the chosen action. Transient HTTP 503 and 429 are handled by the runtime (wait/retry); you receive the final response.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "API action name, as documented by help.",
        },
        route: {
          type: "string",
          description: "Route id when the action requires it.",
        },
        value: {
          type: "string",
          description: "Status value when the action requires it.",
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
    strict: false,
  },
];

async function railway_api(
  args: Record<string, unknown>,
): Promise<RailwayToolResult> {
  const action = String(args.action ?? "").trim();

  if (!action) {
    throw new Error("railway_api requires a non-empty action");
  }

  const route =
    typeof args.route === "string" && args.route.trim()
      ? args.route.trim()
      : undefined;
  const value =
    typeof args.value === "string" && args.value.trim()
      ? args.value.trim()
      : undefined;

  const response = await callRailway({ action, route, value });
  const flag = extractFlag(response.body);

  return {
    status: response.status,
    ok: response.ok,
    body: response.body,
    attempts: response.attempts,
    waitedMs: response.waitedMs,
    flag,
  };
}

const nativeHandlers = {
  railway_api,
};

export function isNativeTool(name: string): boolean {
  return name in nativeHandlers;
}

export async function executeNativeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const handler = nativeHandlers[name as keyof typeof nativeHandlers];

  if (!handler) {
    throw new Error(`Unknown native tool: ${name}`);
  }

  return handler(args);
}
