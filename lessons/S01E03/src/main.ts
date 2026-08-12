import { chatLog } from "./chat-log.js";
import { PORT } from "./config.js";
import {
  createMcpClient,
  listMcpTools,
  mcpToolsToOpenAI,
} from "./mcp/client.js";
import { startServer } from "./server.js";
import { resetSessions } from "./sessions.js";

async function main(): Promise<void> {
  await resetSessions();

  const mcpClient = await createMcpClient();
  const mcpTools = await listMcpTools(mcpClient);
  const tools = mcpToolsToOpenAI(mcpTools);
  chatLog.boot(`MCP ready: ${tools.map((t) => t.name).join(", ")}`);

  const server = startServer({
    port: PORT,
    mcp: { client: mcpClient, tools },
  });

  const shutdown = async () => {
    chatLog.boot("Shutting down");
    server.stop();
    await mcpClient.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
