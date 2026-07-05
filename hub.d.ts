export const HUB_VERIFY_URL: string;

export type HubVerifyResponse = Record<string, unknown> | string;

export class HubVerifyError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly hubMessage: string;
  readonly body: unknown;
}

export function formatHubSuccess(response: HubVerifyResponse): string;

export function submitAnswer<Answer>(params: {
  task: string;
  answer: Answer;
}): Promise<HubVerifyResponse>;
