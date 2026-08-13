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
export type CsvMappingPreset = "auto" | "meta" | "tiktok" | "youtube";
type CsvResult = { rows: AnalyticsCsvSnapshot[]; errors: string[]; headers: string[]; resolvedPreset: CsvMappingPreset; detectedPreset: CsvMappingPreset | null };
type MappingKey = "date" | "platform" | "campaign" | "impressions" | "engagements" | "clicks" | "conversions" | "videoViews" | "saves" | "spend";
type Mapping = Record<MappingKey, string[]>;

export const csvMappingPresets: Record<CsvMappingPreset, { label: string; description: string }> = {
  auto: { label: "Auto-detect", description: "Detect a known platform export from its headers." },
  meta: { label: "Meta Ads", description: "Maps Meta headers such as Reporting starts, Campaign name, Link clicks, and Amount spent." },
  tiktok: { label: "TikTok Ads", description: "Maps TikTok headers such as Stat time day, Campaign name, and Total play actions." },
  youtube: { label: "YouTube / Google Ads", description: "Maps Google Ads headers such as Day, Campaign, Video views, and Cost." },
};

const commonMapping: Mapping = {
  date: ["date", "metricdate", "reportdate", "day"],
  platform: ["platform", "channel", "source"],
  campaign: ["campaign", "campaignname", "campaigntitle"],
  impressions: ["impressions", "impression"],
  engagements: ["engagements", "engagement", "interactions"],
  clicks: ["clicks", "linkclicks", "link_clicks"],
  conversions: ["conversions", "conversion", "purchases", "results"],
  videoViews: ["videoviews", "video_views", "views"],
  saves: ["saves", "saved"],
  spend: ["spend", "amountspent", "amount_spent", "cost"],
};

const presetMappings: Record<Exclude<CsvMappingPreset, "auto">, Mapping> = {
  meta: { ...commonMapping, date: ["reportingstarts", "reportingends", "date", "day"], campaign: ["campaignname", "campaign", "campaigntitle"], engagements: ["postengagement", "engagements", "interactions"], clicks: ["linkclicks", "outboundclicks", "clicks"], conversions: ["websitepurchases", "purchases", "results", "conversions"], videoViews: ["videoplays", "thruplays", "videoviews"], spend: ["amountspent", "spend", "cost"], platform: ["platform"] },
  tiktok: { ...commonMapping, date: ["stattimeday", "date", "day"], campaign: ["campaignname", "campaign", "campaigntitle"], engagements: ["totalplayactions", "engagements", "interactions"], clicks: ["clicks", "destinationclicks", "linkclicks"], conversions: ["conversions", "completepayment", "results"], videoViews: ["videoviews", "videoplayactions", "views"], spend: ["cost", "spend", "amountspent"], platform: ["platform"] },
  youtube: { ...commonMapping, date: ["day", "date", "segmentdate"], campaign: ["campaign", "campaignname"], engagements: ["engagements", "interactions"], clicks: ["clicks"], conversions: ["conversions", "allconversions"], videoViews: ["videoviews", "views"], spend: ["cost", "costmicros", "spend"], platform: ["platform"] },
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
function valueFor(row: Record<string, string>, mapping: Mapping, key: MappingKey) {
  const alias = mapping[key].find(candidate => row[candidate] !== undefined);
  return alias ? row[alias] : "";
}
function metric(value: string) {
  const parsed = Number(value.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
function moneyToCents(value: string, isMicros = false) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return isMicros ? Math.round(parsed / 10_000) : Math.round(parsed * 100);
}
function platform(value: string) {
  const normalized = value.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (["meta", "facebook", "instagram", "fb", "ig"].includes(normalized)) return "meta" as const;
  if (normalized === "tiktok") return "tiktok" as const;
  if (["youtube", "yt", "googleads", "google"].includes(normalized)) return "youtube" as const;
  return null;
}

export function detectCsvMappingPreset(headers: string[]): CsvMappingPreset | null {
  const normalized = headers.map(normalizeHeader);
  if (normalized.includes("reportingstarts") || normalized.includes("amountspent")) return "meta";
  if (normalized.includes("stattimeday") || normalized.includes("totalplayactions")) return "tiktok";
  if (normalized.includes("costmicros") || (normalized.includes("videoviews") && normalized.includes("campaign"))) return "youtube";
  return null;
}

export function parseAnalyticsCsv(text: string, campaigns: AnalyticsCsvCampaign[], fallbackCampaignId?: number, preset: CsvMappingPreset = "auto"): CsvResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { rows: [], headers: [], errors: ["The CSV needs a header row and at least one reporting row."], resolvedPreset: preset, detectedPreset: null };
  const headers = splitRow(lines[0]).map(normalizeHeader);
  const detectedPreset = detectCsvMappingPreset(headers);
  const resolvedPreset = preset === "auto" ? detectedPreset || "auto" : preset;
  const mapping = resolvedPreset === "auto" ? commonMapping : presetMappings[resolvedPreset];
  const required: MappingKey[] = resolvedPreset === "auto" ? ["date", "platform"] : ["date"];
  const missing = required.filter(key => !mapping[key].some(alias => headers.includes(alias)));
  if (missing.length) return { rows: [], headers, errors: [`The ${csvMappingPresets[resolvedPreset].label} mapping needs: ${missing.join(", ")}.`], resolvedPreset, detectedPreset };
  const campaignLookup = new Map<string, number>();
  campaigns.forEach(campaign => [campaign.campaignName, campaign.productName].filter(Boolean).forEach(name => campaignLookup.set(String(name).trim().toLowerCase(), campaign.id)));
  const rows: AnalyticsCsvSnapshot[] = []; const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const values = splitRow(line); const row = Object.fromEntries(headers.map((header, column) => [header, values[column] || ""]));
    const metricDate = valueFor(row, mapping, "date"); const csvCampaign = valueFor(row, mapping, "campaign");
    const sourcePlatform = resolvedPreset === "auto" ? platform(valueFor(row, mapping, "platform")) : resolvedPreset;
    const campaignId = csvCampaign ? campaignLookup.get(csvCampaign.trim().toLowerCase()) : fallbackCampaignId;
    const prefix = `Row ${index + 2}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) { errors.push(`${prefix}: date must use YYYY-MM-DD.`); return; }
    if (!sourcePlatform) { errors.push(`${prefix}: platform must be Meta, TikTok, or YouTube.`); return; }
    if (!campaignId) { errors.push(`${prefix}: select a fallback campaign or include a matching campaign column.`); return; }
    const spendAlias = mapping.spend.find(alias => row[alias] !== undefined);
    rows.push({ campaignId, platform: sourcePlatform, metricDate, impressions: metric(valueFor(row, mapping, "impressions")), engagements: metric(valueFor(row, mapping, "engagements")), clicks: metric(valueFor(row, mapping, "clicks")), conversions: metric(valueFor(row, mapping, "conversions")), videoViews: metric(valueFor(row, mapping, "videoViews")), saves: metric(valueFor(row, mapping, "saves")), spendCents: moneyToCents(valueFor(row, mapping, "spend"), spendAlias === "costmicros") });
  });
  return { rows, headers, errors, resolvedPreset, detectedPreset };
}
