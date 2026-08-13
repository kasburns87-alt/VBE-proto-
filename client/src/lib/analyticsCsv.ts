export type AnalyticsCsvCampaign = { id: number; campaignName?: string | null; productName: string };
export type AnalyticsCsvSnapshot = {
  campaignId: number;
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

type CsvResult = { rows: AnalyticsCsvSnapshot[]; errors: string[]; headers: string[] };

const aliases: Record<string, string[]> = {
  date: ["date", "metricdate", "reportdate", "day"],
  platform: ["platform", "channel", "source"],
  campaign: ["campaign", "campaignname", "campaign_name", "campaigntitle"],
  impressions: ["impressions", "impression"],
  engagements: ["engagements", "engagement", "interactions"],
  clicks: ["clicks", "linkclicks", "link_clicks"],
  conversions: ["conversions", "conversion", "purchases", "results"],
  videoViews: ["videoviews", "video_views", "views"],
  saves: ["saves", "saved"],
  spend: ["spend", "amountspent", "amount_spent", "cost"],
};

function normalizeHeader(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, ""); }
function splitRow(line: string) {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim()); return values;
}
function valueFor(row: Record<string, string>, key: keyof typeof aliases) {
  const alias = aliases[key].find(candidate => row[candidate] !== undefined);
  return alias ? row[alias] : "";
}
function metric(value: string) {
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
function moneyToCents(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}
function platform(value: string) {
  const normalized = value.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (["meta", "facebook", "instagram", "fb", "ig"].includes(normalized)) return "meta" as const;
  if (normalized === "tiktok") return "tiktok" as const;
  if (["youtube", "yt"].includes(normalized)) return "youtube" as const;
  return null;
}

export function parseAnalyticsCsv(text: string, campaigns: AnalyticsCsvCampaign[], fallbackCampaignId?: number): CsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { rows: [], headers: [], errors: ["The CSV needs a header row and at least one reporting row."] };
  const headers = splitRow(lines[0]).map(normalizeHeader);
  const required = ["date", "platform"] as const;
  const missing = required.filter(key => !aliases[key].some(alias => headers.includes(alias)));
  if (missing.length) return { rows: [], headers, errors: [`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] };
  const campaignLookup = new Map<string, number>();
  campaigns.forEach(campaign => {
    [campaign.campaignName, campaign.productName].filter(Boolean).forEach(name => campaignLookup.set(String(name).trim().toLowerCase(), campaign.id));
  });
  const rows: AnalyticsCsvSnapshot[] = []; const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const values = splitRow(line); const row = Object.fromEntries(headers.map((header, column) => [header, values[column] || ""]));
    const metricDate = valueFor(row, "date"); const sourcePlatform = platform(valueFor(row, "platform")); const csvCampaign = valueFor(row, "campaign");
    const campaignId = csvCampaign ? campaignLookup.get(csvCampaign.trim().toLowerCase()) : fallbackCampaignId;
    const prefix = `Row ${index + 2}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) { errors.push(`${prefix}: date must use YYYY-MM-DD.`); return; }
    if (!sourcePlatform) { errors.push(`${prefix}: platform must be Meta, TikTok, or YouTube.`); return; }
    if (!campaignId) { errors.push(`${prefix}: select a fallback campaign or include a matching campaign column.`); return; }
    rows.push({ campaignId, platform: sourcePlatform, metricDate, impressions: metric(valueFor(row, "impressions")), engagements: metric(valueFor(row, "engagements")), clicks: metric(valueFor(row, "clicks")), conversions: metric(valueFor(row, "conversions")), videoViews: metric(valueFor(row, "videoViews")), saves: metric(valueFor(row, "saves")), spendCents: moneyToCents(valueFor(row, "spend")) });
  });
  return { rows, headers, errors };
}
