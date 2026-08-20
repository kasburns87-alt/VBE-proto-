import { describe, expect, it } from "vitest";
import { normalizeStorageKey } from "./storage";

describe("storage key validation", () => {
  it("normalizes a valid relative key while rejecting traversal, absolute paths, alternate separators, and control characters", () => {
    expect(normalizeStorageKey("/campaigns/4/exports/pack.zip")).toBe("campaigns/4/exports/pack.zip");
    for (const key of ["../private.txt", "campaigns/../private.txt", "campaigns\\private.txt", "campaigns/\u0000private.txt", ""]) {
      expect(() => normalizeStorageKey(key)).toThrow("Invalid storage key");
    }
  });
});
