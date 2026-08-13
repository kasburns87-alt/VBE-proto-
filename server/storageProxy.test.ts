import { describe, expect, it } from "vitest";
import { isSafeStorageKey } from "./_core/storageProxy";

describe("storage key validation", () => {
  it("accepts scoped project asset keys", () => {
    expect(isSafeStorageKey("campaigns/42/18/generated/meta-feed.png")).toBe(true);
  });

  it("rejects traversal, absolute, separator, and control-character keys", () => {
    expect(isSafeStorageKey("../secrets.txt")).toBe(false);
    expect(isSafeStorageKey("/campaigns/42/private.pdf")).toBe(false);
    expect(isSafeStorageKey("campaigns\\42\\private.pdf")).toBe(false);
    expect(isSafeStorageKey("campaigns/42/\u0000private.pdf")).toBe(false);
  });
});
