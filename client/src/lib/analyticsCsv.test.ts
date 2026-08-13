import { describe, expect, it } from "vitest";
import { parseAnalyticsCsv } from "./analyticsCsv";

const campaigns = [{ id: 12, campaignName: "Spring Launch", productName: "Pulse" }];

describe("parseAnalyticsCsv", () => {
  it("maps a platform export into an owned campaign snapshot", () => {
    const result = parseAnalyticsCsv("Date,Platform,Campaign,Impressions,Clicks,Spend\n2026-08-01,Facebook,Spring Launch,\"1,250\",34,$12.50", campaigns);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([expect.objectContaining({ campaignId: 12, platform: "meta", impressions: 1250, clicks: 34, spendCents: 1250 })]);
  });

  it("uses a selected fallback campaign when the CSV does not provide a campaign column", () => {
    const result = parseAnalyticsCsv("Date,Platform,Impressions\n2026-08-01,TikTok,640", campaigns, 12);
    expect(result.rows[0]).toEqual(expect.objectContaining({ campaignId: 12, platform: "tiktok", impressions: 640 }));
  });

  it("rejects rows with an unsupported platform or nonstandard date", () => {
    const result = parseAnalyticsCsv("Date,Platform,Campaign\n08/01/2026,LinkedIn,Spring Launch", campaigns);
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toContain("YYYY-MM-DD");
  });
});
