import type { Tool } from "@modelcontextprotocol/sdk/types.js";

type AiOutputTextPart = {
  type: "output_text";
  text?: string;
};

export type AiOutputMessage = {
  type: "message";
  content?: AiOutputTextPart[];
};

export type AiFunctionCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

type AiUnknownOutputItem = {
  type: string;
};

export type AiOutputItem = AiOutputMessage | AiFunctionCall | AiUnknownOutputItem;

export type AiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type AiResponse = {
  output_text?: string;
  output?: AiOutputItem[];
  usage?: AiUsage;
  error?: {
    message: string;
  };
};

export type ToolOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

export type ConversationItem =
  | { role: "user"; content: string }
  | AiOutputItem
  | ToolOutput;

export type ApiUsageTotals = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type OpenAiFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: unknown;
  strict: boolean;
};

export type McpToolDefinition = Tool;
