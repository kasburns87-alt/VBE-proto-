import { and, desc, eq, sql } from "drizzle-orm";
import { campaigns, clients, purchaseOutcomes } from "../drizzle/schema";
import { getDb } from "./db";

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export type PurchaseOutcomeInput = {
  clientId?: number;
  campaignId?: number;
  offerName: string;
  purchaseDate: string;
  amountCents: number;
  currency?: string;
  acquisitionChannel?: string;
  outcome: "completed" | "refunded" | "cancelled";
  customerReference?: string;
  notes?: string;
};

async function assertOwnership(userId: number, input: PurchaseOutcomeInput) {
  const db = requireDb(await getDb());
  if (input.clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.userId, userId))).limit(1);
    if (!client) throw new Error("Client not found.");
  }
  if (input.campaignId) {
    const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, input.campaignId), eq(campaigns.userId, userId))).limit(1);
    if (!campaign) throw new Error("Campaign not found.");
  }
}

export async function recordPurchaseOutcome(userId: number, input: PurchaseOutcomeInput) {
  const db = requireDb(await getDb());
  await assertOwnership(userId, input);
  const [insertResult] = await db.insert(purchaseOutcomes).values({ userId, ...input, currency: input.currency?.toUpperCase() || "USD", acquisitionChannel: input.acquisitionChannel || null, customerReference: input.customerReference || null, notes: input.notes || null, clientId: input.clientId || null, campaignId: input.campaignId || null });
  const id = Number(insertResult.insertId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Purchase outcome could not be saved.");
  const [purchase] = await db.select().from(purchaseOutcomes).where(and(eq(purchaseOutcomes.id, id), eq(purchaseOutcomes.userId, userId))).limit(1);
  return purchase;
}

export async function listPurchaseOutcomes(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(purchaseOutcomes).where(eq(purchaseOutcomes.userId, userId)).orderBy(desc(purchaseOutcomes.purchaseDate), desc(purchaseOutcomes.id)).limit(100);
}

export function summarizePurchaseOutcomes(outcomes: Array<{ offerName: string; acquisitionChannel: string | null; amountCents: number; outcome: string }>) {
  const completed = outcomes.filter(outcome => outcome.outcome === "completed");
  const refunded = outcomes.filter(outcome => outcome.outcome === "refunded");
  const sum = (entries: typeof outcomes) => entries.reduce((total, entry) => total + entry.amountCents, 0);
  const aggregate = (key: "offerName" | "acquisitionChannel") => Object.entries(outcomes.reduce<Record<string, { count: number; netCents: number }>>((map, entry) => {
    const label = entry[key] || "Unattributed";
    const direction = entry.outcome === "completed" ? 1 : entry.outcome === "refunded" ? -1 : 0;
    const current = map[label] || { count: 0, netCents: 0 };
    current.count += 1;
    current.netCents += entry.amountCents * direction;
    map[label] = current;
    return map;
  }, {})).map(([label, value]) => ({ label, ...value })).sort((a, b) => b.netCents - a.netCents);
  return {
    purchaseCount: outcomes.length,
    completedCount: completed.length,
    refundedCount: refunded.length,
    completedRevenueCents: sum(completed),
    refundedCents: sum(refunded),
    netRevenueCents: sum(completed) - sum(refunded),
    topOffers: aggregate("offerName").slice(0, 5),
    topChannels: aggregate("acquisitionChannel").slice(0, 5),
  };
}

export async function getPurchaseIntelligence(userId: number) {
  return summarizePurchaseOutcomes(await listPurchaseOutcomes(userId));
}
