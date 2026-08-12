type PlatformMetrics = {
  platform: "meta" | "tiktok" | "youtube";
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  engagementRate: number;
  clickThroughRate: number;
  conversionRate: number;
};

const names: Record<PlatformMetrics["platform"], string> = { meta: "Meta", tiktok: "TikTok", youtube: "YouTube" };

const highest = (items: PlatformMetrics[], field: keyof PlatformMetrics) => items.reduce((best, item) => Number(item[field]) > Number(best[field]) ? item : best);
const share = (part: number, total: number) => total ? `${((part / total) * 100).toFixed(1)}%` : "0.0%";

export function getPerformanceInterpretation(platforms: PlatformMetrics[]) {
  const active = platforms.filter(platform => platform.impressions > 0);
  if (!active.length) return [];
  const totalImpressions = active.reduce((sum, platform) => sum + platform.impressions, 0);
  const totalConversions = active.reduce((sum, platform) => sum + platform.conversions, 0);
  const reachLeader = highest(active, "impressions");
  const engagementLeader = highest(active, "engagementRate");
  const actionLeader = totalConversions > 0 ? highest(active, "conversions") : highest(active, "clickThroughRate");
  const averageCtr = active.reduce((sum, platform) => sum + platform.clickThroughRate, 0) / active.length;
  const reviewTarget = active.find(platform => platform.impressions === reachLeader.impressions && platform.clickThroughRate < averageCtr);

  return [
    { eyebrow: "Reach lead", title: `${names[reachLeader.platform]} is carrying visibility.`, detail: `${names[reachLeader.platform]} accounts for ${share(reachLeader.impressions, totalImpressions)} of the recorded impressions.`, tone: "rose" },
    { eyebrow: "Engagement lead", title: `${names[engagementLeader.platform]} is earning the strongest response.`, detail: `${engagementLeader.engagementRate.toFixed(2)}% engagement rate across the verified snapshots.`, tone: "violet" },
    { eyebrow: totalConversions > 0 ? "Action lead" : "Click lead", title: totalConversions > 0 ? `${names[actionLeader.platform]} is driving the most recorded conversions.` : `${names[actionLeader.platform]} has the strongest click-through signal.`, detail: totalConversions > 0 ? `${actionLeader.conversions} conversions, representing ${share(actionLeader.conversions, totalConversions)} of the total.` : `${actionLeader.clickThroughRate.toFixed(2)}% click-through rate from the recorded impressions.`, tone: "amber" },
    { eyebrow: "Review cue", title: reviewTarget ? `Inspect ${names[reviewTarget.platform]}'s reach-to-click handoff.` : "Compare the leading creative ingredients.", detail: reviewTarget ? `${names[reviewTarget.platform]} has the largest reach but sits below the average channel CTR of ${averageCtr.toFixed(2)}%.` : "Use the audience, hook, and CTA attached to the leading signals as the next comparison point.", tone: "slate" },
  ];
}
