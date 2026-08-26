import { describe, expect, test } from "bun:test";
import { extractFlag } from "./tools.js";

describe("extractFlag", () => {
  test("finds flag in string", () => {
    expect(extractFlag("done {FLG:ABC123} ok")).toBe("{FLG:ABC123}");
  });

  test("finds flag nested in object", () => {
    expect(extractFlag({ message: "ok", note: "{FLG:XYZ}" })).toBe(
      "{FLG:XYZ}",
    );
  });

  test("returns null when missing", () => {
    expect(extractFlag({ ok: true })).toBeNull();
  });
});
