import { describe, expect, it } from "vitest";
import { getPerformanceInterpretation } from "./performanceInterpretation";

describe("getPerformanceInterpretation", () => {
  it("creates interpretation cues only from the platform metrics supplied", () => {
    const cues = getPerformanceInterpretation([
      { platform: "meta", impressions: 1000, engagements: 50, clicks: 30, conversions: 2, engagementRate: 5, clickThroughRate: 3, conversionRate: 6.67 },
      { platform: "tiktok", impressions: 500, engagements: 45, clicks: 25, conversions: 4, engagementRate: 9, clickThroughRate: 5, conversionRate: 16 },
      { platform: "youtube", impressions: 0, engagements: 0, clicks: 0, conversions: 0, engagementRate: 0, clickThroughRate: 0, conversionRate: 0 },
    ]);

    expect(cues[0]?.detail).toContain("66.7%");
    expect(cues[1]?.title).toContain("TikTok");
    expect(cues[2]?.detail).toContain("4 conversions");
    expect(cues[3]?.title).toContain("Meta");
  });

  it("does not create interpretation without verified reach", () => {
    expect(getPerformanceInterpretation([{ platform: "meta", impressions: 0, engagements: 0, clicks: 0, conversions: 0, engagementRate: 0, clickThroughRate: 0, conversionRate: 0 }])).toEqual([]);
  });
});
