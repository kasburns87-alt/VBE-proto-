export type DatePreset = "all" | "last7" | "last30" | "custom";

function asIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function resolveAnalyticsDateRange(preset: DatePreset, now = new Date()) {
  if (preset === "all" || preset === "custom") return { startDate: undefined, endDate: undefined };
  const days = preset === "last7" ? 7 : 30;
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: asIsoDate(start), endDate: asIsoDate(now) };
}

export function toggleCampaignComparison(selected: number[], campaignId: number) {
  if (selected.includes(campaignId)) return selected.filter(id => id !== campaignId);
  if (selected.length >= 2) return [selected[1], campaignId];
  return [...selected, campaignId];
}

export function isValidAnalyticsDateRange(startDate?: string, endDate?: string) {
  return !startDate || !endDate || startDate <= endDate;
}
