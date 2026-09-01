export type CategorizeItem = {
  id: string;
  description: string;
};

export type HubBudget = {
  inputTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
  ppUsed?: number;
  ppRemaining?: number;
};

export type HubReply = {
  status: number;
  accepted: boolean;
  message: string;
  flag: string | null;
  budget: HubBudget | null;
  budgetExceeded: boolean;
};

export type ItemAttempt = {
  item: CategorizeItem;
  prompt: string;
  reply: HubReply;
};

export type CycleOutcome = {
  ok: boolean;
  flag: string | null;
  resetPerformed: boolean;
  itemsTotal: number;
  attempts: ItemAttempt[];
  rejected: ItemAttempt | null;
  budget: HubBudget | null;
  budgetExceeded: boolean;
  message: string;
};

export type CsvItems = {
  items: CategorizeItem[];
  columns: string[];
};

export type HubUsage = {
  classifyRequests: number;
  resets: number;
};
