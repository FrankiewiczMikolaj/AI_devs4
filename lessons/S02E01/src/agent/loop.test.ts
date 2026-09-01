import { describe, expect, test } from "bun:test";
import type { AiClient } from "../ai/client.js";
import type { AiResponse } from "../ai/types.js";
import type { HubClient } from "../hub/client.js";
import { createEvents, type AgentEvent } from "../observability/events.js";
import type { PromptStore } from "../prompts/store.js";
import { runAgent, type ToolRunner } from "./loop.js";
import type { AgentRole } from "./types.js";

function toolCall(name: string, args: Record<string, unknown> = {}): AiResponse {
  return {
    output: [
      {
        type: "function_call",
        call_id: `call-${name}`,
        name,
        arguments: JSON.stringify(args),
      },
    ],
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 80 },
      output_tokens: 10,
    },
  };
}

const prose = (text: string): AiResponse => ({
  output: [{ type: "message", content: [{ type: "output_text", text }] }],
});

/** Replays scripted responses so the loop can be driven without a provider. */
function scriptedAi(responses: AiResponse[]): AiClient & { calls: number } {
  const client = {
    calls: 0,
    async respond() {
      const response = responses[client.calls] ?? prose("out of script");
      client.calls += 1;
      return response;
    },
  };
  return client;
}

function makeRole(overrides: Partial<AgentRole> = {}): AgentRole {
  return {
    id: "root",
    model: "test-model",
    instructions: "instructions",
    task: "task",
    tools: [],
    maxRounds: 4,
    completion: (_name, result) => {
      const flag = (result as { flag?: string } | null)?.flag;
      return flag ? { ok: true, summary: flag, flag } : null;
    },
    ...overrides,
  };
}

function drive(input: {
  ai: AiClient;
  runTool: ToolRunner;
  role?: Partial<AgentRole>;
}) {
  const events = createEvents();
  const captured: AgentEvent[] = [];
  events.onAny((event) => captured.push(event));

  const run = runAgent({
    role: makeRole(input.role),
    ai: input.ai,
    events,
    runTool: input.runTool,
    toolContext: {
      sessionId: "session-1",
      hub: {} as HubClient,
      store: {} as PromptStore,
      events,
      items: [],
      testedTemplates: new Map(),
      async runEngineer() {
        throw new Error("not used in this test");
      },
    },
  });

  return { run, captured };
}

const alwaysReturn = (result: unknown): ToolRunner => async () => result;

describe("runAgent", () => {
  test("stops as soon as a tool result satisfies the role", async () => {
    const ai = scriptedAi([toolCall("work"), toolCall("work")]);
    const outcome = await drive({
      ai,
      runTool: alwaysReturn({ flag: "{FLG:TEST}" }),
    }).run;

    expect(outcome).toEqual({
      ok: true,
      rounds: 1,
      summary: "{FLG:TEST}",
      flag: "{FLG:TEST}",
      version: null,
    });
    expect(ai.calls).toBe(1);
  });

  test("keeps going while tool results are inconclusive", async () => {
    const ai = scriptedAi([toolCall("work"), toolCall("work"), toolCall("work")]);
    let calls = 0;
    const outcome = await drive({
      ai,
      runTool: async () => {
        calls += 1;
        return calls < 3 ? { ok: false } : { flag: "{FLG:TEST}" };
      },
    }).run;

    expect(outcome.ok).toBe(true);
    expect(outcome.rounds).toBe(3);
  });

  test("gives up when the round budget runs out", async () => {
    const ai = scriptedAi(Array.from({ length: 6 }, () => toolCall("work")));
    const outcome = await drive({ ai, runTool: alwaysReturn({ ok: false }) })
      .run;

    expect(outcome.ok).toBe(false);
    expect(outcome.rounds).toBe(4);
    expect(outcome.summary).toMatch(/limit of 4 rounds/);
    expect(ai.calls).toBe(4);
  });

  test("aborts when the same tool call keeps failing", async () => {
    const ai = scriptedAi(Array.from({ length: 6 }, () => toolCall("work")));
    const outcome = await drive({
      ai,
      role: { maxRounds: 10 },
      runTool: async () => {
        throw new Error("hub is down");
      },
    }).run;

    expect(outcome.ok).toBe(false);
    expect(outcome.rounds).toBe(3);
    expect(outcome.summary).toMatch(/failed 3× with: hub is down/);
  });

  test("a tool failure is reported back and the agent may recover", async () => {
    const ai = scriptedAi([toolCall("broken"), toolCall("working")]);
    const outcome = await drive({
      ai,
      runTool: async (name) => {
        if (name === "broken") {
          throw new Error("nope");
        }
        return { flag: "{FLG:TEST}" };
      },
    }).run;

    expect(outcome.ok).toBe(true);
    expect(outcome.rounds).toBe(2);
  });

  test("stops when the model answers with prose instead of a tool call", async () => {
    const outcome = await drive({
      ai: scriptedAi([prose("I would rather not")]),
      runTool: alwaysReturn({ ok: true }),
    }).run;

    expect(outcome.ok).toBe(false);
    expect(outcome.summary).toBe("I would rather not");
  });

  test("emits paired span events nested under the agent", async () => {
    const { run, captured } = drive({
      ai: scriptedAi([toolCall("work")]),
      runTool: alwaysReturn({ flag: "{FLG:TEST}" }),
    });
    await run;

    expect(captured.map((event) => event.type)).toEqual([
      "agent.started",
      "generation.started",
      "generation.completed",
      "tool.started",
      "tool.completed",
      "agent.completed",
    ]);

    const agentSpan = captured.find(
      (event) => event.type === "agent.started",
    ) as Extract<AgentEvent, { type: "agent.started" }>;
    const toolSpan = captured.find(
      (event) => event.type === "tool.started",
    ) as Extract<AgentEvent, { type: "tool.started" }>;

    expect(agentSpan.parentSpanId).toBeNull();
    expect(toolSpan.parentSpanId).toBe(agentSpan.spanId);
  });

  test("closes the tool span even when the tool throws", async () => {
    const { run, captured } = drive({
      ai: scriptedAi([toolCall("work")]),
      role: { maxRounds: 1 },
      runTool: async () => {
        throw new Error("boom");
      },
    });
    await run;

    const started = captured.find((event) => event.type === "tool.started");
    const failed = captured.find((event) => event.type === "tool.failed");

    expect(started).toBeDefined();
    expect(failed).toBeDefined();
    expect(captured.some((event) => event.type === "tool.completed")).toBe(false);
  });

  test("passes cached input tokens through to the generation event", async () => {
    const { run, captured } = drive({
      ai: scriptedAi([toolCall("work")]),
      runTool: alwaysReturn({ flag: "{FLG:TEST}" }),
    });
    await run;

    const generation = captured.find(
      (event) => event.type === "generation.completed",
    ) as Extract<AgentEvent, { type: "generation.completed" }>;

    expect(generation.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 80,
      outputTokens: 10,
    });
  });

  test("passes the rendered conversation to the generation span", async () => {
    const { run, captured } = drive({
      ai: scriptedAi([toolCall("work")]),
      runTool: alwaysReturn({ flag: "{FLG:TEST}" }),
    });
    await run;

    const generation = captured.find(
      (event) => event.type === "generation.started",
    ) as Extract<AgentEvent, { type: "generation.started" }>;

    expect(generation.messages).toEqual([
      { role: "system", content: "instructions" },
      { role: "user", content: "task" },
    ]);
  });
});
