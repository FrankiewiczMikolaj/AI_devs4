import { createAiClient, describeModel } from "./ai/client.js";
import { runAgent } from "./agent/loop.js";
import { engineerRole, rootRole } from "./agent/roles.js";
import {
  ENGINEER_MODEL,
  PROMPTS_DIR,
  ROOT_MODEL,
  TASK_NAME,
} from "./config.js";
import { createHubClient } from "./hub/client.js";
import { log } from "./logger.js";
import { setupObservability } from "./observability/setup.js";
import { createPromptStore } from "./prompts/store.js";
import { saveFlag } from "./report/flag.js";
import { logRunSummary } from "./report/summary.js";
import { runTool } from "./tools/registry.js";
import type { ToolContext } from "./tools/types.js";

async function main(): Promise<void> {
  const startedAt = Date.now();
  const observability = setupObservability();
  const { events, sessionId } = observability;

  try {
    const ai = createAiClient();
    const hub = createHubClient();
    const store = createPromptStore(PROMPTS_DIR);

    log.info(
      `session ${sessionId.slice(0, 8)} | task=${TASK_NAME} | ` +
        `root=${describeModel(ROOT_MODEL)} engineer=${describeModel(ENGINEER_MODEL)}`,
    );

    const { items, columns } = await hub.fetchItems();
    const versions = await store.list();
    log.info(`items: ${items.length} (${columns.join(", ")})`);

    const toolContext: Omit<ToolContext, "role" | "spanId"> = {
      sessionId,
      hub,
      store,
      events,
      items,
      testedTemplates: new Map(),
      runEngineer: async (brief, parentSpanId) => {
        const outcome = await runAgent({
          role: engineerRole(brief),
          ai,
          events,
          runTool,
          toolContext,
          parentSpanId,
        });

        const saved = outcome.version
          ? await store.get(outcome.version)
          : null;

        return {
          ok: outcome.ok,
          version: outcome.version,
          template: saved?.template ?? null,
          summary: outcome.summary,
          rounds: outcome.rounds,
        };
      },
    };

    const outcome = await runAgent({
      role: rootRole({ items, versions }),
      ai,
      events,
      runTool,
      toolContext,
    });

    logRunSummary({
      outcome,
      tokens: ai.usage(),
      hub: hub.usage(),
      versions: await store.list(),
      elapsedMs: Date.now() - startedAt,
    });

    if (outcome.flag) {
      log.output(await saveFlag({ flag: outcome.flag, sessionId }));
      log.output(outcome.flag);
    } else {
      process.exitCode = 1;
    }
  } finally {
    await observability.shutdown();
  }
}

main().catch((error: unknown) => {
  log.info(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
