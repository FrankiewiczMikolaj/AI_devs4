import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

const SERVER_PATH = path.join(import.meta.dir, "server.ts");

export async function createMcpClient(): Promise<Client> {
  const client = new Client(
    { name: "proxy-mcp-client", version: "1.0.0" },
    { capabilities: {} },
  );

  const transport = new StdioClientTransport({
    command: "bun",
    args: [SERVER_PATH],
    stderr: "inherit",
    env: process.env as Record<string, string>,
  });

  await client.connect(transport);
  return client;
}

export async function listMcpTools(client: Client) {
  const { tools } = await client.listTools();
  return tools;
}

export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  const content = Array.isArray(result.content) ? result.content : [];
  const textPart = content.find(
    (part): part is { type: "text"; text: string } => part.type === "text",
  );

  if (!textPart) {
    return result;
  }

  try {
    return JSON.parse(textPart.text);
  } catch {
    return textPart.text;
  }
}

/** Convert MCP tool schemas to OpenAI Responses API function tools. */
export function mcpToolsToOpenAI(
  mcpTools: Array<{ name: string; description?: string; inputSchema: unknown }>,
) {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema,
    strict: false,
  }));
}