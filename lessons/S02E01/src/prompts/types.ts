export type PromptTokenStats = {
  /** Tokens of the static part before the first placeholder — the cacheable prefix. */
  prefixTokens: number;
  /** Longest filled prompt across the analysed items. */
  maxFilledTokens: number;
  worstCaseItemId: string | null;
  withinLimit: boolean;
};

export type HubRunRecord = {
  runAt: string;
  ok: boolean;
  itemsTested: number;
  rejectedItemId: string | null;
  message: string;
};

export type PromptVersion = {
  version: string;
  createdAt: string;
  sessionId: string;
  parentVersion: string | null;
  template: string;
  tokenStats: PromptTokenStats;
  hubRuns: HubRunRecord[];
};
