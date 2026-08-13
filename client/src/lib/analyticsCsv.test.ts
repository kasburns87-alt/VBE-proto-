import { describe, expect, it } from "vitest";
import { detectCsvMappingPreset, parseAnalyticsCsv } from "./analyticsCsv";

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

  it("auto-detects and maps a Meta Ads report", () => {
    const result = parseAnalyticsCsv("Reporting starts,Campaign name,Amount spent,Link clicks,Website purchases\n2026-08-01,Spring Launch,$12.50,34,3", campaigns, undefined, "auto");
    expect(result.resolvedPreset).toBe("meta");
    expect(result.rows[0]).toEqual(expect.objectContaining({ platform: "meta", clicks: 34, conversions: 3, spendCents: 1250 }));
  });

  it("maps a TikTok report with its reporting-day preset", () => {
    const result = parseAnalyticsCsv("Stat time day,Campaign name,Cost,Total play actions\n2026-08-01,Spring Launch,9.95,84", campaigns, undefined, "tiktok");
    expect(result.rows[0]).toEqual(expect.objectContaining({ platform: "tiktok", engagements: 84, spendCents: 995 }));
  });

  it("maps a YouTube report and detects its column pattern", () => {
    const result = parseAnalyticsCsv("Day,Campaign,Video views,Cost\n2026-08-01,Spring Launch,560,18.00", campaigns, undefined, "youtube");
    expect(detectCsvMappingPreset(["Day", "Campaign", "Video views", "Cost"])).toBe("youtube");
    expect(result.rows[0]).toEqual(expect.objectContaining({ platform: "youtube", videoViews: 560, spendCents: 1800 }));
  });
});
