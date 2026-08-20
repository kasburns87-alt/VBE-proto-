import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientCampaigns, clientCommunications, clientSchedules, clients, reportDeliveries } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { deleteClientWithData, purgeExpiredClientRecords } from "./clientOps";

function buildDb(selectResults: unknown[][], affectedRows: number[] = []) {
  const deletedTables: unknown[] = [];
  let selectIndex = 0;
  let deleteIndex = 0;
  const transaction = {
    delete: (table: unknown) => {
      deletedTables.push(table);
      return { where: vi.fn(async () => [{ affectedRows: affectedRows[deleteIndex++] ?? 1 }]) };
    },
  };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectResults[selectIndex++] || [],
          orderBy: async () => selectResults[selectIndex++] || [],
        }),
        innerJoin: () => ({ where: async () => selectResults[selectIndex++] || [] }),
      }),
    }),
    transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  };
  return { db, deletedTables };
}

describe("client operations persistence", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("cascades deletion across only the selected client’s linked operational records", async () => {
    const { db, deletedTables } = buildDb([[{ id: 77, name: "Client" }], []]);
    mocks.getDb.mockResolvedValue(db);

    await expect(deleteClientWithData(4, 77)).resolves.toEqual({ success: true });
    expect(deletedTables).toEqual([reportDeliveries, clientSchedules, clientCommunications, clientCampaigns, clients]);
  });

  it("purges communication and report records using their independent configured retention windows", async () => {
    const { db, deletedTables } = buildDb([[{ communicationRetentionDays: 30, reportRetentionDays: 90 }]], [3, 2]);
    mocks.getDb.mockResolvedValue(db);

    const result = await purgeExpiredClientRecords(4);
    expect(result.communications).toBe(3);
    expect(result.reports).toBe(2);
    expect(deletedTables).toEqual([clientCommunications, reportDeliveries]);
    expect(Math.round((Date.now() - result.communicationCutoff.getTime()) / 86_400_000)).toBe(30);
    expect(Math.round((Date.now() - result.reportCutoff.getTime()) / 86_400_000)).toBe(90);
  });
});
