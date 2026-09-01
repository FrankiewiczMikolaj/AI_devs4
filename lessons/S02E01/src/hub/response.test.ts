import { describe, expect, test } from "bun:test";
import {
  extractBudget,
  extractFlag,
  extractMessage,
  isBudgetExhausted,
  parseHubReply,
} from "./response.js";

describe("hub reply parsing", () => {
  test("finds the flag anywhere in the body", () => {
    expect(extractFlag({ message: "ACCEPTED - {FLG:SMUGGLER}" })).toBe(
      "{FLG:SMUGGLER}",
    );
    expect(extractFlag({ message: "NOT ACCEPTED" })).toBeNull();
  });

  test("joins nested message fields", () => {
    expect(extractMessage({ message: "top", error: { detail: "why" } })).toBe(
      "top | why",
    );
  });

  test("reads budget fields regardless of key casing", () => {
    expect(
      extractBudget({
        budget: { input_tokens: 40, cachedTokens: 30, "pp-remaining": 0.4 },
      }),
    ).toEqual({ inputTokens: 40, cachedTokens: 30, ppRemaining: 0.4 });
  });

  test("returns no budget when the hub reports none", () => {
    expect(extractBudget({ message: "NOT ACCEPTED" })).toBeNull();
  });

  test("treats a drained PP balance as exhausted", () => {
    expect(isBudgetExhausted("", { ppRemaining: 0 })).toBe(true);
    expect(isBudgetExhausted("Budget exceeded", null)).toBe(true);
    expect(isBudgetExhausted("NOT ACCEPTED", null)).toBe(false);
  });

  test("a rejection mentioning tokens is not an exhausted budget", () => {
    expect(isBudgetExhausted("prompt token limit exceeded", null)).toBe(false);
  });

  test("a token-limit rejection still reports the item as rejected", () => {
    const reply = parseHubReply({
      status: 400,
      httpOk: false,
      body: { message: "NOT ACCEPTED - token limit exceeded" },
    });

    expect(reply.budgetExceeded).toBe(false);
    expect(reply.accepted).toBe(false);
  });

  test("an accepted classification carries no rejection", () => {
    const reply = parseHubReply({
      status: 200,
      httpOk: true,
      body: { message: "OK" },
    });

    expect(reply.accepted).toBe(true);
    expect(reply.flag).toBeNull();
  });

  test("a rejection is detected from the status and from the message", () => {
    expect(
      parseHubReply({ status: 400, httpOk: false, body: { message: "" } })
        .accepted,
    ).toBe(false);

    expect(
      parseHubReply({
        status: 200,
        httpOk: true,
        body: { message: "NOT ACCEPTED" },
      }).accepted,
    ).toBe(false);
  });

  test("a flag wins over a non-2xx status", () => {
    const reply = parseHubReply({
      status: 418,
      httpOk: false,
      body: { message: "{FLG:SMUGGLER}" },
    });

    expect(reply.accepted).toBe(true);
    expect(reply.flag).toBe("{FLG:SMUGGLER}");
  });
});
