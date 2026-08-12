import { describe, expect, it } from "vitest";
import { getCampaignReadiness } from "./campaignReadiness";

const completedOutput = {
  platforms: {
    meta: { headline: "A", primaryText: "B", cta: "C" },
    tiktok: { headline: "A", primaryText: "B", cta: "C" },
    youtube: { headline: "A", primaryText: "B", cta: "C" },
  },
};

describe("getCampaignReadiness", () => {
  it("requires both Meta formats and one format per other selected platform", () => {
    const result = getCampaignReadiness(
      { platforms: JSON.stringify(["meta", "tiktok", "youtube"]) },
      completedOutput,
      [{ platform: "meta" }, { platform: "tiktok" }, { platform: "youtube" }]
    );

    expect(result.items[1]).toMatchObject({ complete: false, detail: "3/4 required visuals are available." });
  });

  it("reaches full readiness when copy, creatives, and an export are present", () => {
    const result = getCampaignReadiness(
      { platforms: JSON.stringify(["meta", "tiktok", "youtube"]), exportUrl: "/manus-storage/campaign.zip" },
      completedOutput,
      [{ platform: "meta" }, { platform: "meta" }, { platform: "tiktok" }, { platform: "youtube" }]
    );

    expect(result.percentage).toBe(100);
    expect(result.items.every(item => item.complete)).toBe(true);
  });
});
