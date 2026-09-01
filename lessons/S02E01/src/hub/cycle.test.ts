import { describe, expect, test } from "bun:test";
import type { HubClient } from "./client.js";
import { runCycle, summarizeCycle } from "./cycle.js";
import { parseHubReply } from "./response.js";
import type { CategorizeItem } from "./types.js";

const TEMPLATE = "Classify.\nID:{id}\nDESC:{description}";

const ITEMS: CategorizeItem[] = [
  { id: "i1", description: "safe box" },
  { id: "i2", description: "reactor fuel cassette" },
  { id: "i3", description: "flamethrower" },
];

/** Hub stub driven by a per-prompt verdict, so cycle control flow is testable. */
function stubClient(
  verdict: (prompt: string, call: number) => { status: number; body: unknown },
): HubClient & { prompts: string[] } {
  const prompts: string[] = [];
  let resets = 0;

  return {
    prompts,
    async fetchItems() {
      return { items: ITEMS, columns: ["code", "description"] };
    },
    async classify(prompt) {
      prompts.push(prompt);
      const { status, body } = verdict(prompt, prompts.length);
      return parseHubReply({ status, httpOk: status < 400, body });
    },
    async reset() {
      resets += 1;
      return parseHubReply({ status: 200, httpOk: true, body: { message: "" } });
    },
    usage() {
      return { classifyRequests: prompts.length, resets };
    },
  };
}

describe("runCycle", () => {
  test("substitutes item data before sending", async () => {
    const client = stubClient(() => ({ status: 200, body: { message: "OK" } }));
    await runCycle({ client, template: TEMPLATE, items: ITEMS, reset: false });

    expect(client.prompts[0]).toBe("Classify.\nID:i1\nDESC:safe box");
    expect(client.prompts[0]).not.toContain("{id}");
  });

  test("stops at the first rejection instead of burning the budget", async () => {
    const client = stubClient((_prompt, call) =>
      call === 2
        ? { status: 400, body: { message: "NOT ACCEPTED" } }
        : { status: 200, body: { message: "OK" } },
    );

    const outcome = await runCycle({
      client,
      template: TEMPLATE,
      items: ITEMS,
      reset: true,
    });

    expect(client.prompts).toHaveLength(2);
    expect(outcome.ok).toBe(false);
    expect(outcome.resetPerformed).toBe(true);
    expect(outcome.rejected?.item.id).toBe("i2");
  });

  test("reports the flag returned on the last item", async () => {
    const client = stubClient((_prompt, call) =>
      call === ITEMS.length
        ? { status: 200, body: { message: "ACCEPTED - {FLG:SMUGGLER}" } }
        : { status: 200, body: { message: "OK" } },
    );

    const outcome = await runCycle({
      client,
      template: TEMPLATE,
      items: ITEMS,
      reset: false,
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.flag).toBe("{FLG:SMUGGLER}");
  });

  test("stops when the hub reports the budget is gone", async () => {
    const client = stubClient(() => ({
      status: 200,
      body: { message: "PP budget exceeded" },
    }));

    const outcome = await runCycle({
      client,
      template: TEMPLATE,
      items: ITEMS,
      reset: false,
    });

    expect(client.prompts).toHaveLength(1);
    expect(outcome.budgetExceeded).toBe(true);
    expect(outcome.rejected).toBeNull();
  });

  test("reports progress for every attempt", async () => {
    const client = stubClient(() => ({ status: 200, body: { message: "OK" } }));
    const seen: number[] = [];

    await runCycle({
      client,
      template: TEMPLATE,
      items: ITEMS,
      reset: false,
      onAttempt: (_attempt, index) => seen.push(index),
    });

    expect(seen).toEqual([0, 1, 2]);
  });
});

describe("summarizeCycle", () => {
  test("keeps the rejected item and drops the per-item transcript", async () => {
    const client = stubClient((_prompt, call) =>
      call === 2
        ? { status: 400, body: { message: "NOT ACCEPTED" } }
        : { status: 200, body: { message: "OK" } },
    );

    const summary = summarizeCycle(
      await runCycle({
        client,
        template: TEMPLATE,
        items: ITEMS,
        reset: false,
      }),
    );

    expect(summary.itemsTested).toBe(2);
    expect(summary.itemsTotal).toBe(3);
    expect(summary.rejectedItem).toEqual({
      id: "i2",
      description: "reactor fuel cassette",
      sentPrompt: "Classify.\nID:i2\nDESC:reactor fuel cassette",
      hubStatus: 400,
      hubMessage: "NOT ACCEPTED",
    });
    expect(summary).not.toHaveProperty("attempts");
  });
});
