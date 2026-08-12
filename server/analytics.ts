export type AnalyticsRow = {
  campaignId: number;
  campaignName: string | null;
  productName: string;
  platform: "meta" | "tiktok" | "youtube";
  metricDate: string;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  videoViews: number;
  saves: number;
  spendCents: number;
};

type Totals = Omit<AnalyticsRow, "campaignId" | "campaignName" | "productName" | "platform" | "metricDate">;

const blankTotals = (): Totals => ({ impressions: 0, engagements: 0, clicks: 0, conversions: 0, videoViews: 0, saves: 0, spendCents: 0 });
const addMetrics = (target: Totals, row: AnalyticsRow) => {
  target.impressions += row.impressions;
  target.engagements += row.engagements;
  target.clicks += row.clicks;
  target.conversions += row.conversions;
  target.videoViews += row.videoViews;
  target.saves += row.saves;
  target.spendCents += row.spendCents;
};
const rate = (numerator: number, denominator: number) => denominator ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
const dollars = (cents: number) => Number((cents / 100).toFixed(2));

function toMetricView(totals: Totals) {
  return {
    ...totals,
    spend: dollars(totals.spendCents),
    engagementRate: rate(totals.engagements, totals.impressions),
    clickThroughRate: rate(totals.clicks, totals.impressions),
    conversionRate: rate(totals.conversions, totals.clicks),
    costPerClick: totals.clicks ? Number((dollars(totals.spendCents) / totals.clicks).toFixed(2)) : 0,
    costPerConversion: totals.conversions ? Number((dollars(totals.spendCents) / totals.conversions).toFixed(2)) : 0,
  };
}

export function summarizeAnalytics(rows: AnalyticsRow[]) {
  const totals = blankTotals();
  const platformMap = new Map<string, Totals>();
  const campaignMap = new Map<number, { name: string; totals: Totals }>();
  const timelineMap = new Map<string, Totals>();

  rows.forEach(row => {
    addMetrics(totals, row);
    const platformTotals = platformMap.get(row.platform) || blankTotals();
    addMetrics(platformTotals, row); platformMap.set(row.platform, platformTotals);
    const campaign = campaignMap.get(row.campaignId) || { name: row.campaignName || row.productName, totals: blankTotals() };
    addMetrics(campaign.totals, row); campaignMap.set(row.campaignId, campaign);
    const dateTotals = timelineMap.get(row.metricDate) || blankTotals();
    addMetrics(dateTotals, row); timelineMap.set(row.metricDate, dateTotals);
  });

  return {
    totals: toMetricView(totals),
    platforms: ["meta", "tiktok", "youtube"].map(platform => ({ platform, ...toMetricView(platformMap.get(platform) || blankTotals()) })),
    campaigns: Array.from(campaignMap.entries()).map(([campaignId, value]) => ({ campaignId, campaignName: value.name, ...toMetricView(value.totals) })).sort((a, b) => b.impressions - a.impressions),
    timeline: Array.from(timelineMap.entries()).map(([date, value]) => ({ date, ...toMetricView(value) })).sort((a, b) => a.date.localeCompare(b.date)),
    snapshotCount: rows.length,
  };
}
