import { and, desc, eq, inArray } from "drizzle-orm";
import {
  campaigns,
  clientCampaigns,
  clientCommunications,
  clients,
  clientSchedules,
  communicationSettings,
  emailSuppressions,
  emailWebhookEvents,
  reportDeliveries,
} from "../drizzle/schema";
import { getDb } from "./db";

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export type ClientInput = {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  title?: string;
  industry?: string;
  status: "lead" | "active" | "paused" | "archived";
  notes?: string;
  rapportDetails?: string;
  campaignIds: number[];
};

async function ownedCampaignIds(userId: number, campaignIds: number[]) {
  const db = requireDb(await getDb());
  const normalized = Array.from(new Set(campaignIds));
  if (!normalized.length) return normalized;
  const owned = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.userId, userId), inArray(campaigns.id, normalized)));
  if (owned.length !== normalized.length) throw new Error("One or more selected campaigns are unavailable in this workspace.");
  return normalized;
}

export async function listClients(userId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.updatedAt));
  if (!rows.length) return [];
  const links = await db
    .select({ clientId: clientCampaigns.clientId, campaignId: clientCampaigns.campaignId, campaignName: campaigns.campaignName, productName: campaigns.productName })
    .from(clientCampaigns)
    .innerJoin(campaigns, eq(clientCampaigns.campaignId, campaigns.id))
    .where(and(eq(clientCampaigns.userId, userId), inArray(clientCampaigns.clientId, rows.map(client => client.id))));
  return rows.map(client => ({
    ...client,
    campaigns: links.filter(link => link.clientId === client.id).map(link => ({ id: link.campaignId, name: link.campaignName || link.productName })),
  }));
}

export async function getClient(userId: number, clientId: number) {
  const db = requireDb(await getDb());
  const [client] = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId))).limit(1);
  if (!client) throw new Error("Client not found.");
  const linkedCampaigns = await db
    .select({ id: campaigns.id, name: campaigns.campaignName, productName: campaigns.productName })
    .from(clientCampaigns)
    .innerJoin(campaigns, eq(clientCampaigns.campaignId, campaigns.id))
    .where(and(eq(clientCampaigns.userId, userId), eq(clientCampaigns.clientId, clientId)));
  return { ...client, campaigns: linkedCampaigns.map(campaign => ({ id: campaign.id, name: campaign.name || campaign.productName })) };
}

export async function createClient(userId: number, input: ClientInput) {
  const db = requireDb(await getDb());
  const campaignIds = await ownedCampaignIds(userId, input.campaignIds);
  const [insertResult] = await db.insert(clients).values({
    userId,
    name: input.name,
    company: input.company || null,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    title: input.title || null,
    industry: input.industry || null,
    status: input.status,
    notes: input.notes || null,
    rapportDetails: input.rapportDetails || null,
  });
  const clientId = Number(insertResult.insertId);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) throw new Error("Client could not be created.");
  if (campaignIds.length) await db.insert(clientCampaigns).values(campaignIds.map(campaignId => ({ userId, clientId, campaignId })));
  return getClient(userId, clientId);
}

export async function updateClient(userId: number, clientId: number, input: ClientInput) {
  const db = requireDb(await getDb());
  await getClient(userId, clientId);
  const campaignIds = await ownedCampaignIds(userId, input.campaignIds);
  await db.update(clients).set({
    name: input.name,
    company: input.company || null,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    title: input.title || null,
    industry: input.industry || null,
    status: input.status,
    notes: input.notes || null,
    rapportDetails: input.rapportDetails || null,
  }).where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  await db.delete(clientCampaigns).where(and(eq(clientCampaigns.userId, userId), eq(clientCampaigns.clientId, clientId)));
  if (campaignIds.length) await db.insert(clientCampaigns).values(campaignIds.map(campaignId => ({ userId, clientId, campaignId })));
  return getClient(userId, clientId);
}

export async function getCommunicationSettings(userId: number) {
  const db = requireDb(await getDb());
  const [settings] = await db.select().from(communicationSettings).where(eq(communicationSettings.userId, userId)).limit(1);
  return settings || null;
}

export async function saveCommunicationSettings(userId: number, input: { fromAddress?: string; replyToAddress?: string; inboundAddress?: string; senderName?: string }) {
  const db = requireDb(await getDb());
  await db.insert(communicationSettings).values({
    userId,
    fromAddress: input.fromAddress || null,
    replyToAddress: input.replyToAddress || null,
    inboundAddress: input.inboundAddress || null,
    senderName: input.senderName || null,
  }).onDuplicateKeyUpdate({ set: {
    fromAddress: input.fromAddress || null,
    replyToAddress: input.replyToAddress || null,
    inboundAddress: input.inboundAddress || null,
    senderName: input.senderName || null,
  } });
  return getCommunicationSettings(userId);
}

export async function listCommunications(userId: number, clientId?: number) {
  const db = requireDb(await getDb());
  const conditions = [eq(clientCommunications.userId, userId)];
  if (clientId) conditions.push(eq(clientCommunications.clientId, clientId));
  return db.select().from(clientCommunications).where(and(...conditions)).orderBy(desc(clientCommunications.createdAt));
}

export async function createOutboundCommunication(userId: number, input: { clientId: number; senderEmail: string; recipientEmail: string; subject: string; bodyText: string; bodyHtml: string; inReplyTo?: string; referencesHeader?: string; threadKey: string; idempotencyKey: string }) {
  const db = requireDb(await getDb());
  await getClient(userId, input.clientId);
  const [existing] = await db.select().from(clientCommunications).where(and(eq(clientCommunications.userId, userId), eq(clientCommunications.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return existing;
  const [insertResult] = await db.insert(clientCommunications).values({
    userId,
    clientId: input.clientId,
    direction: "outbound",
    status: "queued",
    senderEmail: input.senderEmail,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
    inReplyTo: input.inReplyTo || null,
    referencesHeader: input.referencesHeader || null,
    threadKey: input.threadKey,
    idempotencyKey: input.idempotencyKey,
  });
  const id = Number(insertResult.insertId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Outbound email could not be queued.");
  const [communication] = await db.select().from(clientCommunications).where(and(eq(clientCommunications.id, id), eq(clientCommunications.userId, userId))).limit(1);
  if (!communication) throw new Error("Outbound email could not be found.");
  return communication;
}

export async function updateCommunicationStatus(userId: number, communicationId: number, patch: { status: "sent" | "delivered" | "bounced" | "complained" | "suppressed" | "unsubscribed" | "failed"; providerMessageId?: string; messageId?: string; providerEventId?: string; errorMessage?: string }) {
  const db = requireDb(await getDb());
  await db.update(clientCommunications).set({
    status: patch.status,
    providerMessageId: patch.providerMessageId || undefined,
    messageId: patch.messageId || undefined,
    providerEventId: patch.providerEventId || undefined,
    sentAt: patch.status === "sent" ? new Date() : undefined,
    bodyText: patch.errorMessage ? `Delivery error: ${patch.errorMessage}` : undefined,
  }).where(and(eq(clientCommunications.id, communicationId), eq(clientCommunications.userId, userId)));
}

export async function recordInboundCommunication(input: { userId: number; clientId: number | null; senderEmail: string; recipientEmail: string; subject: string; bodyText?: string; bodyHtml?: string; providerMessageId: string; providerEventId: string; messageId?: string; inReplyTo?: string; referencesHeader?: string; threadKey: string; receivedAt: Date }) {
  const db = requireDb(await getDb());
  const [existing] = await db.select().from(clientCommunications).where(eq(clientCommunications.providerEventId, input.providerEventId)).limit(1);
  if (existing) return existing;
  const [insertResult] = await db.insert(clientCommunications).values({
    userId: input.userId,
    clientId: input.clientId,
    direction: "inbound",
    status: "received",
    senderEmail: input.senderEmail.toLowerCase(),
    recipientEmail: input.recipientEmail.toLowerCase(),
    subject: input.subject || "(No subject)",
    bodyText: input.bodyText || null,
    bodyHtml: input.bodyHtml || null,
    providerMessageId: input.providerMessageId,
    providerEventId: input.providerEventId,
    messageId: input.messageId || null,
    inReplyTo: input.inReplyTo || null,
    referencesHeader: input.referencesHeader || null,
    threadKey: input.threadKey,
    receivedAt: input.receivedAt,
  });
  const id = Number(insertResult.insertId);
  const [communication] = await db.select().from(clientCommunications).where(eq(clientCommunications.id, id)).limit(1);
  if (!communication) throw new Error("Inbound email could not be saved.");
  return communication;
}

export async function findInboundOwner(recipientEmail: string) {
  const db = requireDb(await getDb());
  const [settings] = await db.select().from(communicationSettings).where(eq(communicationSettings.inboundAddress, recipientEmail.toLowerCase())).limit(1);
  return settings || null;
}

export async function findClientByEmail(userId: number, email: string) {
  const db = requireDb(await getDb());
  const [client] = await db.select().from(clients).where(and(eq(clients.userId, userId), eq(clients.email, email.toLowerCase()))).limit(1);
  return client || null;
}

export async function getCommunicationByProviderMessageId(providerMessageId: string) {
  const db = requireDb(await getDb());
  const [communication] = await db.select().from(clientCommunications).where(eq(clientCommunications.providerMessageId, providerMessageId)).limit(1);
  return communication || null;
}

export async function getCommunicationByMessageId(userId: number, messageId: string) {
  const db = requireDb(await getDb());
  const [communication] = await db.select().from(clientCommunications).where(and(eq(clientCommunications.userId, userId), eq(clientCommunications.messageId, messageId))).limit(1);
  return communication || null;
}

export async function recordEmailWebhookEvent(input: { providerEventId: string; providerMessageId?: string; eventType: string; userId?: number | null; communicationId?: number | null; payloadJson: string }) {
  const db = requireDb(await getDb());
  const [existing] = await db.select().from(emailWebhookEvents).where(eq(emailWebhookEvents.providerEventId, input.providerEventId)).limit(1);
  if (existing) return { event: existing, created: false };
  const [insertResult] = await db.insert(emailWebhookEvents).values({
    providerEventId: input.providerEventId,
    providerMessageId: input.providerMessageId || null,
    eventType: input.eventType,
    userId: input.userId || null,
    communicationId: input.communicationId || null,
    payloadJson: input.payloadJson,
  });
  const eventId = Number(insertResult.insertId);
  const [event] = await db.select().from(emailWebhookEvents).where(eq(emailWebhookEvents.id, eventId)).limit(1);
  if (!event) throw new Error("Webhook event could not be recorded.");
  return { event, created: true };
}

export async function finalizeEmailWebhookEvent(eventId: number, patch: { status: "processed" | "ignored" | "failed"; errorMessage?: string }) {
  const db = requireDb(await getDb());
  await db.update(emailWebhookEvents).set({ status: patch.status, errorMessage: patch.errorMessage || null, processedAt: new Date() }).where(eq(emailWebhookEvents.id, eventId));
}

export async function isEmailSuppressed(userId: number, email: string) {
  const db = requireDb(await getDb());
  const [suppression] = await db.select().from(emailSuppressions).where(and(eq(emailSuppressions.userId, userId), eq(emailSuppressions.email, email.toLowerCase()))).limit(1);
  return suppression || null;
}

export async function upsertEmailSuppression(input: { userId: number; email: string; reason: "unsubscribe" | "bounce" | "complaint" | "manual"; sourceEventId?: string }) {
  const db = requireDb(await getDb());
  const normalizedEmail = input.email.toLowerCase();
  await db.insert(emailSuppressions).values({ userId: input.userId, email: normalizedEmail, reason: input.reason, sourceEventId: input.sourceEventId || null }).onDuplicateKeyUpdate({ set: { reason: input.reason, sourceEventId: input.sourceEventId || null, updatedAt: new Date() } });
  const [suppression] = await db.select().from(emailSuppressions).where(and(eq(emailSuppressions.userId, input.userId), eq(emailSuppressions.email, normalizedEmail))).limit(1);
  if (!suppression) throw new Error("Email suppression could not be saved.");
  return suppression;
}

export async function listEmailSuppressions(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(emailSuppressions).where(eq(emailSuppressions.userId, userId)).orderBy(desc(emailSuppressions.updatedAt));
}

export async function removeEmailSuppression(userId: number, suppressionId: number) {
  const db = requireDb(await getDb());
  await db.delete(emailSuppressions).where(and(eq(emailSuppressions.id, suppressionId), eq(emailSuppressions.userId, userId)));
}

export type ScheduleInput = {
  clientId?: number;
  scheduleType: "follow_up" | "weekly_report" | "reminder";
  label: string;
  recipientEmail?: string;
  timezone: string;
  cronExpression?: string;
};

export async function listClientSchedules(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(clientSchedules).where(eq(clientSchedules.userId, userId)).orderBy(desc(clientSchedules.updatedAt));
}

export async function getClientSchedule(userId: number, scheduleId: number) {
  const db = requireDb(await getDb());
  const [schedule] = await db.select().from(clientSchedules).where(and(eq(clientSchedules.id, scheduleId), eq(clientSchedules.userId, userId))).limit(1);
  if (!schedule) throw new Error("Schedule not found.");
  return schedule;
}

export async function createClientSchedule(userId: number, input: ScheduleInput) {
  const db = requireDb(await getDb());
  if (input.clientId) await getClient(userId, input.clientId);
  const [insertResult] = await db.insert(clientSchedules).values({ ...input, userId, clientId: input.clientId || null, recipientEmail: input.recipientEmail || null, cronExpression: input.cronExpression || null });
  const id = Number(insertResult.insertId);
  const [schedule] = await db.select().from(clientSchedules).where(and(eq(clientSchedules.id, id), eq(clientSchedules.userId, userId))).limit(1);
  if (!schedule) throw new Error("Schedule could not be created.");
  return schedule;
}

export async function getScheduleByTaskUid(taskUid: string) {
  const db = requireDb(await getDb());
  const [schedule] = await db.select().from(clientSchedules).where(eq(clientSchedules.scheduleCronTaskUid, taskUid)).limit(1);
  return schedule || null;
}

export async function setScheduleHeartbeat(userId: number, scheduleId: number, patch: { taskUid?: string | null; isEnabled?: number; nextRunAt?: Date | null; lastRunAt?: Date | null }) {
  const db = requireDb(await getDb());
  await db.update(clientSchedules).set({
    scheduleCronTaskUid: patch.taskUid,
    isEnabled: patch.isEnabled,
    nextRunAt: patch.nextRunAt,
    lastRunAt: patch.lastRunAt,
  }).where(and(eq(clientSchedules.id, scheduleId), eq(clientSchedules.userId, userId)));
}

export async function createReportDelivery(input: { userId: number; clientId?: number | null; scheduleId?: number | null; periodStart: string; periodEnd: string; recipientEmail: string; idempotencyKey: string }) {
  const db = requireDb(await getDb());
  await db.insert(reportDeliveries).values({ ...input, clientId: input.clientId || null, scheduleId: input.scheduleId || null, status: "queued" }).onDuplicateKeyUpdate({ set: { idempotencyKey: input.idempotencyKey } });
  const [delivery] = await db.select().from(reportDeliveries).where(eq(reportDeliveries.idempotencyKey, input.idempotencyKey)).limit(1);
  if (!delivery) throw new Error("Report delivery could not be created.");
  return delivery;
}

export async function updateReportDelivery(userId: number, deliveryId: number, patch: { status: "generated" | "sent" | "failed" | "skipped"; fileKey?: string; fileUrl?: string; providerMessageId?: string; errorMessage?: string }) {
  const db = requireDb(await getDb());
  await db.update(reportDeliveries).set({ ...patch, sentAt: patch.status === "sent" ? new Date() : undefined }).where(and(eq(reportDeliveries.id, deliveryId), eq(reportDeliveries.userId, userId)));
}

export async function listReportDeliveries(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(reportDeliveries).where(eq(reportDeliveries.userId, userId)).orderBy(desc(reportDeliveries.createdAt));
}
