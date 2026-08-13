import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  campaignAnalytics,
  campaignAssets,
  campaigns,
  InsertUser,
  savedAnalyticsViews,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type CampaignCreateInput = {
  userId: number;
  productName: string;
  industry: string;
  targetAudience: string;
  goal: string;
  tone: string;
  platforms: string[];
};

export async function createCampaign(input: CampaignCreateInput) {
  const db = requireDb(await getDb());
  await db.insert(campaigns).values({
    userId: input.userId,
    productName: input.productName,
    industry: input.industry,
    targetAudience: input.targetAudience,
    goal: input.goal,
    tone: input.tone,
    platforms: JSON.stringify(input.platforms),
    briefJson: JSON.stringify(input),
  });
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, input.userId))
    .orderBy(desc(campaigns.id))
    .limit(1);
  if (!campaign) throw new Error("Campaign could not be created.");
  return campaign;
}

export async function updateCampaignOutput(
  userId: number,
  campaignId: number,
  output: { campaignName: string; insightsJson: string; status: "complete" | "failed" }
) {
  const db = requireDb(await getDb());
  await db
    .update(campaigns)
    .set(output)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
}

export async function saveCampaignAssets(
  userId: number,
  campaignId: number,
  assets: Array<{
    platform: "meta" | "tiktok" | "youtube";
    assetType: "image" | "video" | "audio" | "copy_sheet";
    format: string;
    label: string;
    fileKey: string;
    fileUrl: string;
    mimeType: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    metadataJson?: string;
  }>
) {
  const db = requireDb(await getDb());
  if (assets.length === 0) return;
  await db.insert(campaignAssets).values(
    assets.map(asset => ({ ...asset, userId, campaignId }))
  );
}

export async function saveCampaignExport(
  userId: number,
  campaignId: number,
  exportFile: { key: string; url: string }
) {
  const db = requireDb(await getDb());
  await db
    .update(campaigns)
    .set({ exportKey: exportFile.key, exportUrl: exportFile.url })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
}

export async function getCampaignsForUser(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.updatedAt));
}

export async function getCampaignWithAssets(userId: number, campaignId: number) {
  const db = requireDb(await getDb());
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
    .limit(1);
  if (!campaign) return null;
  const assets = await db
    .select()
    .from(campaignAssets)
    .where(and(eq(campaignAssets.campaignId, campaignId), eq(campaignAssets.userId, userId)))
    .orderBy(desc(campaignAssets.createdAt));
  return { ...campaign, assets };
}

export type AnalyticsSnapshotInput = {
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

export async function recordAnalyticsSnapshot(userId: number, input: AnalyticsSnapshotInput) {
  const db = requireDb(await getDb());
  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, userId)))
    .limit(1);
  if (!campaign) throw new Error("Campaign not found.");
  await db.insert(campaignAnalytics).values({ ...input, userId });
  const [snapshot] = await db
    .select()
    .from(campaignAnalytics)
    .where(and(eq(campaignAnalytics.campaignId, input.campaignId), eq(campaignAnalytics.userId, userId)))
    .orderBy(desc(campaignAnalytics.id))
    .limit(1);
  if (!snapshot) throw new Error("Analytics snapshot could not be saved.");
  return snapshot;
}

export type AnalyticsSnapshotFilters = {
  campaignIds?: number[];
  startDate?: string;
  endDate?: string;
};

export async function getAnalyticsSnapshotsForUser(userId: number, filters: AnalyticsSnapshotFilters = {}) {
  const db = requireDb(await getDb());
  const conditions = [eq(campaignAnalytics.userId, userId)];
  if (filters.campaignIds?.length) conditions.push(inArray(campaignAnalytics.campaignId, filters.campaignIds));
  if (filters.startDate) conditions.push(gte(campaignAnalytics.metricDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(campaignAnalytics.metricDate, filters.endDate));
  return db
    .select({
      id: campaignAnalytics.id,
      campaignId: campaignAnalytics.campaignId,
      campaignName: campaigns.campaignName,
      productName: campaigns.productName,
      platform: campaignAnalytics.platform,
      metricDate: campaignAnalytics.metricDate,
      impressions: campaignAnalytics.impressions,
      engagements: campaignAnalytics.engagements,
      clicks: campaignAnalytics.clicks,
      conversions: campaignAnalytics.conversions,
      videoViews: campaignAnalytics.videoViews,
      saves: campaignAnalytics.saves,
      spendCents: campaignAnalytics.spendCents,
    })
    .from(campaignAnalytics)
    .innerJoin(campaigns, and(eq(campaigns.id, campaignAnalytics.campaignId), eq(campaigns.userId, campaignAnalytics.userId)))
    .where(and(...conditions))
    .orderBy(desc(campaignAnalytics.metricDate), desc(campaignAnalytics.id));
}

export type SavedAnalyticsViewInput = {
  name: string;
  datePreset: "all" | "last7" | "last30" | "custom";
  startDate?: string;
  endDate?: string;
  campaignIds: number[];
};

export async function createSavedAnalyticsView(userId: number, input: SavedAnalyticsViewInput) {
  const db = requireDb(await getDb());
  const campaignIds = Array.from(new Set(input.campaignIds));
  if (campaignIds.length) {
    const ownedCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.userId, userId), inArray(campaigns.id, campaignIds)));
    if (ownedCampaigns.length !== campaignIds.length) throw new Error("A selected campaign is no longer available in your workspace.");
  }
  await db.insert(savedAnalyticsViews).values({
    userId,
    name: input.name,
    datePreset: input.datePreset,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    campaignIdsJson: JSON.stringify(campaignIds),
  });
  const [savedView] = await db
    .select()
    .from(savedAnalyticsViews)
    .where(eq(savedAnalyticsViews.userId, userId))
    .orderBy(desc(savedAnalyticsViews.id))
    .limit(1);
  if (!savedView) throw new Error("Saved view could not be created.");
  return savedView;
}

export async function listSavedAnalyticsViews(userId: number) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(savedAnalyticsViews)
    .where(eq(savedAnalyticsViews.userId, userId))
    .orderBy(desc(savedAnalyticsViews.updatedAt), desc(savedAnalyticsViews.id));
}

export async function deleteSavedAnalyticsView(userId: number, viewId: number) {
  const db = requireDb(await getDb());
  await db
    .delete(savedAnalyticsViews)
    .where(and(eq(savedAnalyticsViews.id, viewId), eq(savedAnalyticsViews.userId, userId)));
  return { success: true } as const;
}
