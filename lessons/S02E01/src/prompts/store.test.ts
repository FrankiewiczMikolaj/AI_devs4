import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPromptStore, type PromptStore } from "./store.js";
import type { PromptTokenStats } from "./types.js";

const TOKEN_STATS: PromptTokenStats = {
  prefixTokens: 12,
  maxFilledTokens: 40,
  worstCaseItemId: "i1",
  withinLimit: true,
};

let dir = "";
let store: PromptStore;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "s02e01-store-"));
  store = createPromptStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const save = (template: string, parentVersion: string | null = null) =>
  store.save({
    template,
    sessionId: "session-1",
    parentVersion,
    tokenStats: TOKEN_STATS,
  });

describe("prompt store", () => {
  test("starts empty", async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.latest()).toBeNull();
    expect(await store.get("v001")).toBeNull();
  });

  test("numbers versions and chains them to the previous one", async () => {
    const first = await save("first {id} {description}");
    const second = await save("second {id} {description}");

    expect(first.version).toBe("v001");
    expect(second.version).toBe("v002");
    expect(second.parentVersion).toBe("v001");
    expect((await store.latest())?.version).toBe("v002");
    expect(await store.list()).toHaveLength(2);
  });

  test("honours an explicit parent version", async () => {
    await save("first {id} {description}");
    await save("second {id} {description}");
    const third = await save("third {id} {description}", "v001");

    expect(third.parentVersion).toBe("v001");
  });

  test("writes the template next to its metadata", async () => {
    const saved = await save("template {id} {description}");
    const onDisk = await readFile(
      path.join(dir, saved.version, "template.txt"),
      "utf8",
    );

    expect(onDisk.trim()).toBe("template {id} {description}");
  });

  test("appends hub runs to the version history", async () => {
    const saved = await save("template {id} {description}");
    await store.appendHubRun(saved.version, {
      runAt: "2026-09-01T06:00:00.000Z",
      ok: false,
      itemsTested: 2,
      rejectedItemId: "i2",
      ppUsed: null,
      message: "NOT ACCEPTED",
    });

    const reloaded = await store.get(saved.version);
    expect(reloaded?.hubRuns).toHaveLength(1);
    expect(reloaded?.hubRuns[0]?.rejectedItemId).toBe("i2");
  });

  test("ignores hub runs for an unknown version", async () => {
    await store.appendHubRun("v404", {
      runAt: "2026-09-01T06:00:00.000Z",
      ok: true,
      itemsTested: 10,
      rejectedItemId: null,
      ppUsed: null,
      message: "",
    });

    expect(await store.list()).toEqual([]);
  });
});
