import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createHubClient } from "./client.js";

const CSV = "code,description\ni2101,safe box\n";
const realFetch = globalThis.fetch;

function respondWith(handler: (url: string) => Response): void {
  globalThis.fetch = mock(async (url: unknown) =>
    handler(String(url)),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.HUB_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.HUB_API_KEY;
});

describe("hub client", () => {
  test("requires an api key", async () => {
    delete process.env.HUB_API_KEY;
    respondWith(() => new Response(CSV));

    expect(createHubClient().fetchItems()).rejects.toThrow(/HUB_API_KEY/);
  });

  test("encodes the api key in the csv url", async () => {
    process.env.HUB_API_KEY = "a/b+c";
    let requested = "";
    respondWith((url) => {
      requested = url;
      return new Response(CSV);
    });

    await createHubClient().fetchItems();
    expect(requested).toContain("/data/a%2Fb%2Bc/categorize.csv");
  });

  test("throws when the csv download fails", async () => {
    respondWith(() => new Response("nope", { status: 404 }));

    expect(createHubClient().fetchItems()).rejects.toThrow(
      /Failed to fetch categorize\.csv \(404\)/,
    );
  });

  test("retries a rate-limited CSV download", async () => {
    let downloads = 0;
    respondWith(() => {
      downloads += 1;
      return downloads === 1
        ? new Response("slow down", {
            status: 429,
            headers: { "retry-after": "0" },
          })
        : new Response(CSV);
    });

    const items = await createHubClient().fetchItems();
    expect(downloads).toBe(2);
    expect(items.items).toHaveLength(1);
  });

  test("counts classify calls and resets separately", async () => {
    const prompts: string[] = [];
    globalThis.fetch = mock(async (_url: unknown, options: unknown) => {
      const body = JSON.parse(String((options as RequestInit).body)) as {
        answer: { prompt: string };
      };
      prompts.push(body.answer.prompt);
      return new Response(JSON.stringify({ message: "OK" }));
    }) as unknown as typeof fetch;

    const client = createHubClient();
    await client.reset();
    await client.classify("classify me");

    expect(prompts).toEqual(["reset", "classify me"]);
    expect(client.usage()).toEqual({ classifyRequests: 1, resets: 1 });
  });
});
