import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}, table => [index("campaigns_user_updated_idx").on(table.userId, table.updatedAt)]);

export const campaignAssets = mysqlTable("campaignAssets", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}, table => [index("campaign_assets_owner_campaign_created_idx").on(table.userId, table.campaignId, table.createdAt)]);

export const campaignAnalytics = mysqlTable("campaignAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
}, table => [index("campaign_analytics_owner_date_campaign_idx").on(table.userId, table.metricDate, table.campaignId)]);

export const savedAnalyticsViews = mysqlTable("savedAnalyticsViews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  datePreset: varchar("datePreset", { length: 20 }).notNull(),
  startDate: varchar("startDate", { length: 10 }),
  endDate: varchar("endDate", { length: 10 }),
  campaignIdsJson: varchar("campaignIdsJson", { length: 80 }).notNull(),
  isDefault: int("isDefault").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("saved_analytics_views_owner_updated_idx").on(table.userId, table.updatedAt)]);

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  company: varchar("company", { length: 180 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  title: varchar("title", { length: 140 }),
  industry: varchar("industry", { length: 140 }),
  status: mysqlEnum("status", ["lead", "active", "paused", "archived"]).default("lead").notNull(),
  notes: text("notes"),
  rapportDetails: text("rapportDetails"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("clients_owner_status_updated_idx").on(table.userId, table.status, table.updatedAt),
  uniqueIndex("clients_owner_email_unique").on(table.userId, table.email),
]);

export const clientCampaigns = mysqlTable("clientCampaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
  campaignId: int("campaignId").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("client_campaigns_owner_pair_unique").on(table.userId, table.clientId, table.campaignId),
  index("client_campaigns_owner_client_idx").on(table.userId, table.clientId),
]);

export const communicationSettings = mysqlTable("communicationSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  fromAddress: varchar("fromAddress", { length: 320 }),
  replyToAddress: varchar("replyToAddress", { length: 320 }),
  inboundAddress: varchar("inboundAddress", { length: 320 }),
  senderName: varchar("senderName", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clientCommunications = mysqlTable("clientCommunications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  channel: mysqlEnum("channel", ["email"]).default("email").notNull(),
  status: mysqlEnum("status", ["draft", "queued", "sent", "delivered", "bounced", "complained", "suppressed", "unsubscribed", "received", "failed"]).notNull(),
  senderEmail: varchar("senderEmail", { length: 320 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 300 }).notNull(),
  bodyText: text("bodyText"),
  bodyHtml: text("bodyHtml"),
  providerMessageId: varchar("providerMessageId", { length: 160 }),
  messageId: varchar("messageId", { length: 320 }),
  inReplyTo: varchar("inReplyTo", { length: 300 }),
  referencesHeader: text("referencesHeader"),
  threadKey: varchar("threadKey", { length: 320 }),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }),
  providerEventId: varchar("providerEventId", { length: 160 }),
  sentAt: timestamp("sentAt"),
  receivedAt: timestamp("receivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("client_comms_owner_created_idx").on(table.userId, table.createdAt),
  index("client_comms_owner_client_created_idx").on(table.userId, table.clientId, table.createdAt),
  uniqueIndex("client_comms_provider_event_unique").on(table.providerEventId),
  uniqueIndex("client_comms_idempotency_unique").on(table.idempotencyKey),
  index("client_comms_owner_thread_idx").on(table.userId, table.threadKey, table.createdAt),
]);

export const emailWebhookEvents = mysqlTable("emailWebhookEvents", {
  id: int("id").autoincrement().primaryKey(),
  providerEventId: varchar("providerEventId", { length: 160 }).notNull(),
  providerMessageId: varchar("providerMessageId", { length: 160 }),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  communicationId: int("communicationId").references(() => clientCommunications.id, { onDelete: "set null" }),
  payloadJson: text("payloadJson").notNull(),
  status: mysqlEnum("status", ["received", "processed", "ignored", "failed"]).notNull().default("received"),
  errorMessage: text("errorMessage"),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
}, table => [
  uniqueIndex("email_webhook_events_provider_event_unique").on(table.providerEventId),
  index("email_webhook_events_owner_created_idx").on(table.userId, table.receivedAt),
]);

export const emailSuppressions = mysqlTable("emailSuppressions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  reason: mysqlEnum("reason", ["unsubscribe", "bounce", "complaint", "manual"]).notNull(),
  sourceEventId: varchar("sourceEventId", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("email_suppressions_owner_email_unique").on(table.userId, table.email),
]);

export const clientSchedules = mysqlTable("clientSchedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: int("clientId").references(() => clients.id, { onDelete: "cascade" }),
  scheduleType: mysqlEnum("scheduleType", ["follow_up", "weekly_report", "reminder"]).notNull(),
  label: varchar("label", { length: 180 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  timezone: varchar("timezone", { length: 80 }).notNull().default("UTC"),
  cronExpression: varchar("cronExpression", { length: 80 }),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  isEnabled: int("isEnabled").notNull().default(0),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("client_schedules_owner_enabled_idx").on(table.userId, table.isEnabled),
  uniqueIndex("client_schedules_task_uid_unique").on(table.scheduleCronTaskUid),
]);

export const reportDeliveries = mysqlTable("reportDeliveries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
  scheduleId: int("scheduleId").references(() => clientSchedules.id, { onDelete: "set null" }),
  periodStart: varchar("periodStart", { length: 10 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 10 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["queued", "generated", "sent", "failed", "skipped"]).notNull().default("queued"),
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: varchar("fileUrl", { length: 700 }),
  providerMessageId: varchar("providerMessageId", { length: 160 }),
  errorMessage: text("errorMessage"),
  idempotencyKey: varchar("idempotencyKey", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
}, table => [
  uniqueIndex("report_deliveries_idempotency_unique").on(table.idempotencyKey),
  index("report_deliveries_owner_created_idx").on(table.userId, table.createdAt),
]);

export const userUsageCounters = mysqlTable("userUsageCounters", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  periodKey: varchar("periodKey", { length: 7 }).notNull(),
  campaignGenerations: int("campaignGenerations").notNull().default(0),
  assistantRequests: int("assistantRequests").notNull().default(0),
  reportGenerations: int("reportGenerations").notNull().default(0),
  outboundEmails: int("outboundEmails").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("user_usage_counters_owner_period_unique").on(table.userId, table.periodKey)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignAsset = typeof campaignAssets.$inferSelect;
export type CampaignAnalytics = typeof campaignAnalytics.$inferSelect;
export type SavedAnalyticsView = typeof savedAnalyticsViews.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type ClientCommunication = typeof clientCommunications.$inferSelect;
export type EmailWebhookEvent = typeof emailWebhookEvents.$inferSelect;
export type EmailSuppression = typeof emailSuppressions.$inferSelect;
export type ClientSchedule = typeof clientSchedules.$inferSelect;
export type ReportDelivery = typeof reportDeliveries.$inferSelect;
export type UserUsageCounter = typeof userUsageCounters.$inferSelect;
