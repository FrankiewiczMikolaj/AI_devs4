import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { log } from "../logger.js";
import type { McpToolDefinition } from "../types.js";

const LESSON_ROOT = path.join(import.meta.dir, "../..");

type McpServerConfig = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

type McpConfig = {
  mcpServers: Record<string, McpServerConfig>;
};

async function loadMcpConfig(): Promise<McpConfig> {
  const configPath = path.join(LESSON_ROOT, "mcp.json");
  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content) as McpConfig;
}

export async function createMcpClient(
  serverName = "files",
): Promise<Client> {
  const config = await loadMcpConfig();
  const serverConfig = config.mcpServers[serverName];

  if (!serverConfig) {
    throw new Error(`MCP server "${serverName}" not found in mcp.json`);
  }

  const client = new Client(
    { name: "sendit-mcp-client", version: "1.0.0" },
    { capabilities: {} },
  );

  log.info(`Spawning MCP server: ${serverName}`);
  log.info(`Command: ${serverConfig.command} ${serverConfig.args.join(" ")}`);

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    cwd: LESSON_ROOT,
    stderr: "inherit",
    env: {
      ...process.env,
      ...serverConfig.env,
    } as Record<string, string>,
  });

  await client.connect(transport);
  log.info(`Connected to ${serverName} via stdio`);

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

export function mcpToolsToOpenAI(mcpTools: McpToolDefinition[]) {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema,
    strict: false,
  }));
}

export async function closeMcpClient(client: Client): Promise<void> {
  await client.close();
  log.info("MCP client closed");
}
