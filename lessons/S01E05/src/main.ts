import { runAgent } from "./agent.js";
import { saveFlag } from "./flag.js";
import { log } from "./logger.js";
import { nativeTools } from "./native/tools.js";
import { setupObservability } from "./observability/setup.js";
import { logRunSummary } from "./summary.js";

async function main(): Promise<void> {
  const observability = setupObservability();

  try {
    log.info(`Tools: ${nativeTools.map((tool) => tool.name).join(", ")}`);

    const run = await runAgent({
      events: observability.events,
      sessionId: observability.sessionId,
    });

    logRunSummary({
      ok: run.ok,
      rounds: run.rounds,
      summary: run.summary,
    });

    if (run.ok && run.flag) {
      await saveFlag({
        flag: run.flag,
        sessionId: observability.sessionId,
      });
    }

    if (!run.ok) {
      process.exitCode = 1;
    }
  } finally {
    await observability.shutdown();
  }
}

main().catch((error: unknown) => {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
