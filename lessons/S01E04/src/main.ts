import { runAgent } from "./agent.js";
import { getApiUsage } from "./api.js";
import { resetDeclaration } from "./declaration.js";
import { syncSpkDocumentation } from "./hub-data.js";
import { log } from "./logger.js";
import {
  closeMcpClient,
  createMcpClient,
  listMcpTools,
} from "./mcp/client.js";
import { nativeTools } from "./native/tools.js";

function logApiUsage(): void {
  const usage = getApiUsage();

  log.info(
    `API usage: ${usage.requests} requests, ${usage.inputTokens} in + ${usage.outputTokens} out = ${usage.totalTokens} tokens`,
  );
}

async function main(): Promise<void> {
  await syncSpkDocumentation();
  await resetDeclaration();

  const mcpClient = await createMcpClient();

  try {
    const mcpTools = await listMcpTools(mcpClient);
    const toolNames = [...mcpTools, ...nativeTools].map((tool) => tool.name);
    log.info(`Tools: ${toolNames.join(", ")}`);

    const run = await runAgent({ mcpClient, mcpTools });

    log.info(
      `${run.accepted ? "Accepted" : "Not accepted"} after ${run.rounds} rounds`,
    );
    log.output(run.summary);

    if (!run.accepted) {
      process.exitCode = 1;
    }
  } finally {
    logApiUsage();
    await closeMcpClient(mcpClient);
  }
}

main().catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
