import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { createModuleIntegrationContract, getOrCreateDefaultWorkspace } from "./workspaces";

function buildDb(selectResults: unknown[][], insertResults: unknown[][] = []) {
  let selectIndex = 0;
  let insertIndex = 0;
  const values = vi.fn(async () => insertResults[insertIndex++] || []);
  const terminal = () => async () => selectResults[selectIndex++] || [];
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: terminal(), orderBy: terminal() }) }),
        where: () => ({ limit: terminal(), orderBy: terminal() }),
      }),
    }),
    insert: () => ({ values }),
  };
  return { db, values };
}

describe("workspace integration boundary", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("reuses an existing member workspace rather than creating an additional workspace", async () => {
    const existing = { workspace: { id: 12, name: "Acme workspace" }, membership: { workspaceId: 12, userId: 4, role: "owner" } };
    const { db, values } = buildDb([[existing]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(getOrCreateDefaultWorkspace(4, "Acme")).resolves.toEqual(existing);
    expect(values).not.toHaveBeenCalled();
  });

  it("creates an owner membership for a new default workspace", async () => {
    const created = { workspace: { id: 12, name: "Acme workspace" }, membership: { workspaceId: 12, userId: 4, role: "owner" } };
    const { db, values } = buildDb([[], [created]], [[{ insertId: 12 }], [{ insertId: 1 }]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(getOrCreateDefaultWorkspace(4, "Acme")).resolves.toEqual(created);
    expect(values).toHaveBeenNthCalledWith(1, expect.objectContaining({ createdByUserId: 4, name: "Acme workspace" }));
    expect(values).toHaveBeenNthCalledWith(2, { workspaceId: 12, userId: 4, role: "owner" });
  });

  it("denies a member from publishing a module integration contract", async () => {
    const member = { workspace: { id: 12 }, membership: { workspaceId: 12, userId: 4, role: "member" } };
    const { db, values } = buildDb([[member]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(createModuleIntegrationContract(4, {
      workspaceId: 12,
      sourceModule: "pulseforge",
      targetModule: "launchpro",
      contractType: "campaign_pack_manifest",
      contractVersion: "v1",
      entityType: "campaign",
      entityId: "42",
      status: "draft",
      payload: { campaignId: 42 },
      correlationId: "correlation-42",
      idempotencyKey: "campaign-contract-00042",
    })).rejects.toThrow("do not have access");
    expect(values).not.toHaveBeenCalled();
  });
});
