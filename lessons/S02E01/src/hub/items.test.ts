import { describe, expect, test } from "bun:test";
import { parseItemsCsv } from "./items.js";

describe("parseItemsCsv", () => {
  test("maps the hub column layout", () => {
    const result = parseItemsCsv(
      "code,description\ni2101,safe box\ni2567,reactor fuel cassette\n",
    );

    expect(result.columns).toEqual(["code", "description"]);
    expect(result.items).toEqual([
      { id: "i2101", description: "safe box" },
      { id: "i2567", description: "reactor fuel cassette" },
    ]);
  });

  test("accepts the polish alias for the description column", () => {
    const result = parseItemsCsv("id,opis\nA-1,bezpieczna paczka\n");

    expect(result.items[0]).toEqual({ id: "A-1", description: "bezpieczna paczka" });
  });

  test("keeps commas inside a quoted description", () => {
    const result = parseItemsCsv(
      'code,description\ni1,"fuel cassette, micro-fractures"\n',
    );

    expect(result.items[0]?.description).toBe("fuel cassette, micro-fractures");
  });

  test("fails loudly on an unknown column layout", () => {
    expect(() => parseItemsCsv("foo,bar\n1,2\n")).toThrow(
      /unexpected columns: foo, bar/,
    );
  });

  test("fails on an empty file", () => {
    expect(() => parseItemsCsv("")).toThrow(/empty/);
  });
});
