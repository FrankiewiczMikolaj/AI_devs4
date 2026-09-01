import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvents } from "./events.js";
import { subscribeJsonl } from "./jsonl.js";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "s02e01-jsonl-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("subscribeJsonl", () => {
  test("flushes pending events before unsubscribe resolves", async () => {
    const events = createEvents();
    const unsub = subscribeJsonl(events, "session-1", {
      enabled: true,
      runsDir: dir,
    });

    events.emit({
      type: "hub.attempt",
      index: 0,
      total: 1,
      itemId: "i1",
      accepted: true,
      flag: null,
      status: 200,
      message: "OK",
      timestamp: Date.now(),
    });

    await unsub();

    const lines = (await readFile(path.join(dir, "session-1.jsonl"), "utf8"))
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      type: "hub.attempt",
      itemId: "i1",
    });
  });
});
