import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clientCommunications, clientSchedules, clients, communicationSettings, reportDeliveries, users } from "../drizzle/schema";

/**
 * This suite is deliberately opt-in. Set PULSEFORGE_ISOLATED_TEST_DATABASE_URL
 * to a dedicated disposable MySQL/TiDB database that has received the project
 * migrations. It must never point to the deployed application database.
 */
const isolatedDatabaseUrl = process.env.PULSEFORGE_ISOLATED_TEST_DATABASE_URL;
const integration = isolatedDatabaseUrl ? describe : describe.skip;

integration("client operation persistence boundaries (isolated database)", () => {
  const token = `pulseforge-isolated-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const db = isolatedDatabaseUrl ? drizzle(isolatedDatabaseUrl) : null;
  let deleteClientWithData: typeof import("./clientOps").deleteClientWithData;
  let purgeExpiredClientRecords: typeof import("./clientOps").purgeExpiredClientRecords;
  let ownerId = 0;
  let otherOwnerId = 0;

  beforeAll(() => {
    if (!isolatedDatabaseUrl) throw new Error("PULSEFORGE_ISOLATED_TEST_DATABASE_URL is required for persisted-data verification.");
    if (isolatedDatabaseUrl === process.env.DATABASE_URL) throw new Error("Refusing to run persisted-data tests against DATABASE_URL. Configure a dedicated isolated database.");
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = isolatedDatabaseUrl;
    ({ deleteClientWithData, purgeExpiredClientRecords } = await import("./clientOps"));
    const [owner] = await db!.insert(users).values({ openId: `${token}-owner`, name: "Isolated test owner" });
    const [otherOwner] = await db!.insert(users).values({ openId: `${token}-other`, name: "Isolated test other owner" });
    ownerId = Number(owner.insertId);
    otherOwnerId = Number(otherOwner.insertId);
  });

  it("deletes only the selected owner’s client records and linked operational data", async () => {
    const [ownerClient] = await db!.insert(clients).values({ userId: ownerId, name: "Delete target", email: `${token}-owner@example.test` });
    const [otherClient] = await db!.insert(clients).values({ userId: otherOwnerId, name: "Other owner", email: `${token}-other@example.test` });
    const ownerClientId = Number(ownerClient.insertId);
    const otherClientId = Number(otherClient.insertId);
    await db!.insert(clientCommunications).values([
      { userId: ownerId, clientId: ownerClientId, direction: "outbound", channel: "email", status: "draft", senderEmail: "sender@example.test", recipientEmail: `${token}-owner@example.test`, subject: "Owner", threadKey: `${token}-owner` },
      { userId: otherOwnerId, clientId: otherClientId, direction: "outbound", channel: "email", status: "draft", senderEmail: "sender@example.test", recipientEmail: `${token}-other@example.test`, subject: "Other", threadKey: `${token}-other` },
    ]);
    await db!.insert(clientSchedules).values([{ userId: ownerId, clientId: ownerClientId, scheduleType: "reminder", label: "Owner reminder" }, { userId: otherOwnerId, clientId: otherClientId, scheduleType: "reminder", label: "Other reminder" }]);
    await db!.insert(reportDeliveries).values([{ userId: ownerId, clientId: ownerClientId, periodStart: "2026-01-01", periodEnd: "2026-01-07", recipientEmail: `${token}-owner@example.test`, idempotencyKey: `${token}-owner-report` }, { userId: otherOwnerId, clientId: otherClientId, periodStart: "2026-01-01", periodEnd: "2026-01-07", recipientEmail: `${token}-other@example.test`, idempotencyKey: `${token}-other-report` }]);

    await expect(deleteClientWithData(ownerId, ownerClientId)).resolves.toEqual({ success: true });
    expect(await db!.select().from(clients).where(eq(clients.id, ownerClientId))).toHaveLength(0);
    expect(await db!.select().from(clientCommunications).where(eq(clientCommunications.clientId, ownerClientId))).toHaveLength(0);
    expect(await db!.select().from(clientSchedules).where(eq(clientSchedules.clientId, ownerClientId))).toHaveLength(0);
    expect(await db!.select().from(reportDeliveries).where(eq(reportDeliveries.clientId, ownerClientId))).toHaveLength(0);
    expect(await db!.select().from(clients).where(eq(clients.id, otherClientId))).toHaveLength(1);
    expect(await db!.select().from(clientCommunications).where(eq(clientCommunications.clientId, otherClientId))).toHaveLength(1);
    expect(await db!.select().from(clientSchedules).where(eq(clientSchedules.clientId, otherClientId))).toHaveLength(1);
    expect(await db!.select().from(reportDeliveries).where(eq(reportDeliveries.clientId, otherClientId))).toHaveLength(1);
  });

  it("purges only records older than each owner’s independent retention cutoff", async () => {
    const now = Date.now();
    await db!.insert(communicationSettings).values({ userId: ownerId, communicationRetentionDays: 30, reportRetentionDays: 90 });
    await db!.insert(clientCommunications).values([
      { userId: ownerId, direction: "outbound", channel: "email", status: "draft", senderEmail: "sender@example.test", recipientEmail: `${token}-old@example.test`, subject: "Old", threadKey: `${token}-old`, createdAt: new Date(now - 31 * 86_400_000) },
      { userId: ownerId, direction: "outbound", channel: "email", status: "draft", senderEmail: "sender@example.test", recipientEmail: `${token}-recent@example.test`, subject: "Recent", threadKey: `${token}-recent`, createdAt: new Date(now - 29 * 86_400_000) },
      { userId: otherOwnerId, direction: "outbound", channel: "email", status: "draft", senderEmail: "sender@example.test", recipientEmail: `${token}-other-old@example.test`, subject: "Other old", threadKey: `${token}-other-old`, createdAt: new Date(now - 400 * 86_400_000) },
    ]);
    await db!.insert(reportDeliveries).values([
      { userId: ownerId, periodStart: "2025-01-01", periodEnd: "2025-01-07", recipientEmail: `${token}-old-report@example.test`, idempotencyKey: `${token}-old-report-boundary`, createdAt: new Date(now - 91 * 86_400_000) },
      { userId: ownerId, periodStart: "2025-02-01", periodEnd: "2025-02-07", recipientEmail: `${token}-recent-report@example.test`, idempotencyKey: `${token}-recent-report-boundary`, createdAt: new Date(now - 89 * 86_400_000) },
      { userId: otherOwnerId, periodStart: "2025-01-01", periodEnd: "2025-01-07", recipientEmail: `${token}-other-report@example.test`, idempotencyKey: `${token}-other-report-boundary`, createdAt: new Date(now - 400 * 86_400_000) },
    ]);

    await expect(purgeExpiredClientRecords(ownerId)).resolves.toMatchObject({ communications: 1, reports: 1 });
    const ownerCommunications = await db!.select().from(clientCommunications).where(eq(clientCommunications.userId, ownerId));
    const ownerReports = await db!.select().from(reportDeliveries).where(eq(reportDeliveries.userId, ownerId));
    expect(ownerCommunications.some(row => row.recipientEmail === `${token}-old@example.test`)).toBe(false);
    expect(ownerCommunications.some(row => row.recipientEmail === `${token}-recent@example.test`)).toBe(true);
    expect(ownerReports.some(row => row.idempotencyKey === `${token}-old-report-boundary`)).toBe(false);
    expect(ownerReports.some(row => row.idempotencyKey === `${token}-recent-report-boundary`)).toBe(true);
    expect(await db!.select().from(clientCommunications).where(and(eq(clientCommunications.userId, otherOwnerId), eq(clientCommunications.recipientEmail, `${token}-other-old@example.test`)))).toHaveLength(1);
    expect(await db!.select().from(reportDeliveries).where(and(eq(reportDeliveries.userId, otherOwnerId), eq(reportDeliveries.idempotencyKey, `${token}-other-report-boundary`)))).toHaveLength(1);
  });

  afterAll(async () => {
    if (db && ownerId && otherOwnerId) await db.delete(users).where(inArray(users.id, [ownerId, otherOwnerId]));
  });
});
