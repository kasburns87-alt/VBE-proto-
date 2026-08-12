import { describe, expect, it } from "vitest";
import { summarizeAnalytics } from "./analytics";

describe("summarizeAnalytics", () => {
  it("calculates aggregate and platform-specific performance without invented values", () => {
    const summary = summarizeAnalytics([
      { campaignId: 1, campaignName: "Spring", productName: "Aster", platform: "meta", metricDate: "2026-08-01", impressions: 1000, engagements: 80, clicks: 40, conversions: 4, videoViews: 300, saves: 12, spendCents: 8000 },
      { campaignId: 1, campaignName: "Spring", productName: "Aster", platform: "tiktok", metricDate: "2026-08-01", impressions: 500, engagements: 50, clicks: 20, conversions: 2, videoViews: 420, saves: 15, spendCents: 3000 },
    ]);

    expect(summary.totals).toMatchObject({ impressions: 1500, engagements: 130, clicks: 60, conversions: 6, spend: 110, engagementRate: 8.67, clickThroughRate: 4, conversionRate: 10 });
    expect(summary.platforms.find(item => item.platform === "meta")).toMatchObject({ impressions: 1000, costPerClick: 2 });
    expect(summary.timeline).toHaveLength(1);
  });

  it("returns zero-safe metrics when a data series has no denominator", () => {
    const summary = summarizeAnalytics([]);
    expect(summary.totals).toMatchObject({ engagementRate: 0, clickThroughRate: 0, conversionRate: 0, costPerClick: 0, costPerConversion: 0 });
  });
});
