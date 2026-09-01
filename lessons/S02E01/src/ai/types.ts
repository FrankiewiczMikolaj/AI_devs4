export type FunctionToolSchema = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
};

export type ToolCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type OutputTextPart = {
  type: "output_text";
  text?: string;
};

export type OutputMessage = {
  type: "message";
  content?: OutputTextPart[];
};

export type FunctionCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

type UnknownOutputItem = {
  type: string;
};

export type OutputItem = OutputMessage | FunctionCall | UnknownOutputItem;

export type Usage = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens?: number;
  total_tokens?: number;
};

export type AiResponse = {
  output_text?: string;
  output?: OutputItem[];
  usage?: Usage;
  error?: { message: string };
};

export type ConversationItem =
  | { role: "user"; content: string }
  | OutputItem
  | ToolCallOutput;

export type TokenTotals = {
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};
