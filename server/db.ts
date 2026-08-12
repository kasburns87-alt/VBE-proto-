import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  campaignAssets,
  campaigns,
  InsertUser,
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
