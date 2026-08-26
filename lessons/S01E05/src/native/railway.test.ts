import { describe, expect, test } from "bun:test";
import { readRetryAfterSeconds } from "./railway.js";

describe("readRetryAfterSeconds", () => {
  test("reads number", () => {
    expect(readRetryAfterSeconds({ retry_after: 29 })).toBe(29);
  });

  test("reads numeric string", () => {
    expect(readRetryAfterSeconds({ retry_after: "34" })).toBe(34);
  });

  test("returns null when missing", () => {
    expect(readRetryAfterSeconds({ message: "nope" })).toBeNull();
  });

  test("returns null for invalid values", () => {
    expect(readRetryAfterSeconds({ retry_after: -1 })).toBeNull();
    expect(readRetryAfterSeconds({ retry_after: "x" })).toBeNull();
  });
});
