import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  campaignName: varchar("campaignName", { length: 220 }),
  productName: varchar("productName", { length: 180 }).notNull(),
  industry: varchar("industry", { length: 140 }).notNull(),
  targetAudience: text("targetAudience").notNull(),
  goal: varchar("goal", { length: 160 }).notNull(),
  tone: varchar("tone", { length: 120 }).notNull(),
  platforms: varchar("platforms", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "complete", "failed"]).default("draft").notNull(),
  briefJson: text("briefJson").notNull(),
  insightsJson: text("insightsJson"),
  exportKey: varchar("exportKey", { length: 512 }),
  exportUrl: varchar("exportUrl", { length: 700 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const campaignAssets = mysqlTable("campaignAssets", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId").notNull(),
  platform: mysqlEnum("platform", ["meta", "tiktok", "youtube"]).notNull(),
  assetType: mysqlEnum("assetType", ["image", "video", "audio", "copy_sheet"]).notNull(),
  format: varchar("format", { length: 120 }).notNull(),
  label: varchar("label", { length: 220 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 700 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  width: int("width"),
  height: int("height"),
  durationSeconds: int("durationSeconds"),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const campaignAnalytics = mysqlTable("campaignAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId").notNull(),
  platform: mysqlEnum("platform", ["meta", "tiktok", "youtube"]).notNull(),
  metricDate: varchar("metricDate", { length: 10 }).notNull(),
  impressions: int("impressions").notNull().default(0),
  engagements: int("engagements").notNull().default(0),
  clicks: int("clicks").notNull().default(0),
  conversions: int("conversions").notNull().default(0),
  videoViews: int("videoViews").notNull().default(0),
  saves: int("saves").notNull().default(0),
  spendCents: int("spendCents").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignAsset = typeof campaignAssets.$inferSelect;
export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;
