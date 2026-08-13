import { describe, expect, it } from "vitest";
import { isUsageWithinLimit, MONTHLY_USAGE_LIMITS, usagePeriodKey } from "./db";

describe("monthly usage policy", () => {
  it("uses a stable UTC month key for user-scoped accounting", () => {
    expect(usagePeriodKey(new Date("2026-08-13T23:59:59.000Z"))).toBe("2026-08");
    expect(usagePeriodKey(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09");
  });

  it("permits actions below the monthly cap and rejects the cap boundary", () => {
    expect(isUsageWithinLimit(MONTHLY_USAGE_LIMITS.campaignGenerations - 1, "campaignGenerations")).toBe(true);
    expect(isUsageWithinLimit(MONTHLY_USAGE_LIMITS.campaignGenerations, "campaignGenerations")).toBe(false);
    expect(isUsageWithinLimit(-1, "outboundEmails")).toBe(false);
  });
});
