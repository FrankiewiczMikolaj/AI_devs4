import { describe, expect, test } from "bun:test";
import { MAX_PROMPT_TOKENS } from "../config.js";
import { analyzeTemplate, countTokens, fillTemplate } from "./tokenizer.js";

const TEMPLATE = "Classify shipment. Reply DNG or NEU.\nID:{id}\nDESC:{description}";

describe("fillTemplate", () => {
  test("replaces both placeholders", () => {
    expect(
      fillTemplate("ID:{id} DESC:{description}", {
        id: "A1",
        description: "fuel rod",
      }),
    ).toBe("ID:A1 DESC:fuel rod");
  });

  test("replaces every occurrence", () => {
    expect(
      fillTemplate("{id} … {id}", { id: "A1", description: "x" }),
    ).toBe("A1 … A1");
  });
});

describe("analyzeTemplate", () => {
  test("measures the cacheable prefix up to the first placeholder", () => {
    const stats = analyzeTemplate(TEMPLATE, []);

    expect(stats.prefixTokens).toBe(
      countTokens("Classify shipment. Reply DNG or NEU.\nID:"),
    );
  });

  test("picks the longest filled prompt as the worst case", () => {
    const stats = analyzeTemplate(TEMPLATE, [
      { id: "1", description: "short" },
      { id: "VERY-LONG-ID", description: "a much longer dangerous description" },
    ]);

    expect(stats.worstCaseItemId).toBe("VERY-LONG-ID");
    expect(stats.maxFilledTokens).toBeGreaterThan(stats.prefixTokens);
    expect(stats.withinLimit).toBe(true);
  });

  test("a template inside the limit can still exceed it once filled", () => {
    const longDescription = "dangerous ".repeat(200);
    const stats = analyzeTemplate(TEMPLATE, [
      { id: "i1", description: longDescription },
    ]);

    expect(countTokens(TEMPLATE)).toBeLessThan(MAX_PROMPT_TOKENS);
    expect(stats.withinLimit).toBe(false);
    expect(stats.maxFilledTokens).toBeGreaterThan(MAX_PROMPT_TOKENS);
  });

  test("falls back to the raw template when no items are known", () => {
    const stats = analyzeTemplate(TEMPLATE, []);

    expect(stats.maxFilledTokens).toBe(countTokens(TEMPLATE));
    expect(stats.worstCaseItemId).toBeNull();
  });
});
