export type CampaignPlatform = "meta" | "tiktok" | "youtube";

const labels: Record<CampaignPlatform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function selectedPlatforms(value?: string): CampaignPlatform[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is CampaignPlatform => item === "meta" || item === "tiktok" || item === "youtube")
      : [];
  } catch {
    return [];
  }
}

export function getCampaignReadiness(campaign: any, output: any, imageAssets: any[]) {
  const platforms = selectedPlatforms(campaign?.platforms);
  const expectedVisuals = platforms.reduce((count, platform) => count + (platform === "meta" ? 2 : 1), 0);
  const copyReady = platforms.length > 0 && platforms.every(platform => Boolean(output?.platforms?.[platform]?.headline && output?.platforms?.[platform]?.primaryText && output?.platforms?.[platform]?.cta));
  const visualReady = platforms.length > 0 && platforms.every(platform => imageAssets.filter(asset => asset.platform === platform).length >= (platform === "meta" ? 2 : 1));
  const items = [
    { label: "Platform-native copy", detail: copyReady ? `${platforms.map(platform => labels[platform]).join(", ")} copy is complete.` : "Copy needs a completed platform section.", complete: copyReady },
    { label: "Creative coverage", detail: `${imageAssets.length}/${expectedVisuals} required visuals are available.`, complete: visualReady },
    { label: "Pack handoff", detail: campaign?.exportUrl ? "Export is saved and ready to share." : "Export the campaign pack when approvals are complete.", complete: Boolean(campaign?.exportUrl) },
  ];
  const completed = items.filter(item => item.complete).length;
  return { items, percentage: Math.round((completed / items.length) * 100) };
}
