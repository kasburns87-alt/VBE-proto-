import { describe, expect, it } from "vitest";
import { isValidAnalyticsDateRange, resolveAnalyticsDateRange, toggleCampaignComparison } from "./analyticsFilters";

describe("analytics filter helpers", () => {
  it("resolves inclusive seven and thirty-day ranges from a fixed reporting date", () => {
    const reportingDate = new Date("2026-08-15T12:00:00Z");
    expect(resolveAnalyticsDateRange("last7", reportingDate)).toEqual({ startDate: "2026-08-09", endDate: "2026-08-15" });
    expect(resolveAnalyticsDateRange("last30", reportingDate)).toEqual({ startDate: "2026-07-17", endDate: "2026-08-15" });
  });

  it("keeps campaign comparisons limited to the two most recent selections", () => {
    expect(toggleCampaignComparison([4], 9)).toEqual([4, 9]);
    expect(toggleCampaignComparison([4, 9], 12)).toEqual([9, 12]);
    expect(toggleCampaignComparison([4, 9], 4)).toEqual([9]);
  });

  it("rejects a custom range that ends before it begins", () => {
    expect(isValidAnalyticsDateRange("2026-08-15", "2026-08-12")).toBe(false);
    expect(isValidAnalyticsDateRange("2026-08-12", "2026-08-15")).toBe(true);
  });
});
