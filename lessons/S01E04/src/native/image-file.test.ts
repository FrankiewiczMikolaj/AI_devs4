import path from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveLessonPath, resolveMimeType } from "./image-file.js";

const LESSON_ROOT = path.join(import.meta.dir, "../..");

describe("resolveMimeType", () => {
  test("maps supported extensions regardless of case", () => {
    expect(resolveMimeType("map.PNG")).toBe("image/png");
    expect(resolveMimeType("scan.jpeg")).toBe("image/jpeg");
  });

  test("rejects anything that is not a known image", () => {
    expect(() => resolveMimeType("workspace/spk/index.md")).toThrow(
      /Not an image file/,
    );
  });
});

describe("resolveLessonPath", () => {
  test("resolves paths inside the lesson directory", () => {
    expect(resolveLessonPath("workspace/spk/map.png")).toBe(
      path.join(LESSON_ROOT, "workspace/spk/map.png"),
    );
  });

  test("blocks traversal outside the lesson directory", () => {
    expect(() => resolveLessonPath("../../../etc/passwd")).toThrow(
      /leaves the lesson directory/,
    );
  });

  test("blocks absolute paths outside the lesson directory", () => {
    expect(() => resolveLessonPath("/etc/passwd")).toThrow(
      /leaves the lesson directory/,
    );
  });
});
