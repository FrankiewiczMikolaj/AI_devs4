import { describe, expect, test } from "bun:test";
import { extractIncludes } from "./hub-data.js";

describe("extractIncludes", () => {
  test("returns every referenced file in document order", () => {
    const markdown = [
      "# Rules",
      '[include file="fees.md"]',
      "text in between",
      '[include file="nested/limits.md"]',
    ].join("\n");

    expect(extractIncludes(markdown)).toEqual(["fees.md", "nested/limits.md"]);
  });

  test("ignores malformed directives", () => {
    const markdown = [
      "[include file=fees.md]",
      '[include file=""]',
      "[include]",
    ].join("\n");

    expect(extractIncludes(markdown)).toEqual([]);
  });

  test("returns an empty list for plain documents", () => {
    expect(extractIncludes("nothing to include here")).toEqual([]);
  });
});
