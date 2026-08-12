type AiOutputTextPart = {
  type: "output_text";
  text?: string;
};

type AiOutputMessage = {
  type: "message";
  content?: AiOutputTextPart[];
};

export type AiFunctionCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

export type AiResponse = {
  output_text?: string;
  output?: Array<AiOutputMessage | AiFunctionCall | { type: string }>;
  error?: {
    message: string;
  };
};

/** Incoming Hub / operator POST body */
export type ProxyRequestBody = {
  sessionID?: string;
  msg?: string;
};

export type OpenAiFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: unknown;
  strict: boolean;
};
