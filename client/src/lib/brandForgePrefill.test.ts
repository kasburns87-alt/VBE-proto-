import { describe, expect, it } from "vitest";
import { canApplyBrandForgeProfile, getBrandForgePrefillState } from "./brandForgePrefill";

describe("BrandForge executive prefill guards", () => {
  it("permits only an approved profile with an object payload", () => {
    expect(canApplyBrandForgeProfile({ id: 1, status: "approved", payload: { brandName: "VBE" } })).toBe(true);
    expect(canApplyBrandForgeProfile({ id: 2, status: "draft", payload: { brandName: "VBE" } })).toBe(false);
    expect(canApplyBrandForgeProfile({ id: 3, status: "rejected", payload: { brandName: "VBE" } })).toBe(false);
    expect(canApplyBrandForgeProfile({ id: 4, status: "superseded", payload: { brandName: "VBE" } })).toBe(false);
  });

  it("distinguishes a protected-query failure from an honest empty approved-profile list", () => {
    expect(getBrandForgePrefillState({ loading: false, error: true, count: 0 })).toBe("error");
    expect(getBrandForgePrefillState({ loading: false, error: false, count: 0 })).toBe("empty");
  });
});
