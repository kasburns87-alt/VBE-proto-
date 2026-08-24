import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ purchases: vi.fn(), createContract: vi.fn(), listContracts: vi.fn(), requireMembership: vi.fn() }));
vi.mock("./purchaseIntelligence", () => ({ listPurchaseOutcomes: mocks.purchases }));
vi.mock("./workspaces", () => ({ createModuleIntegrationContract: mocks.createContract, listModuleIntegrationContracts: mocks.listContracts, requireWorkspaceMembership: mocks.requireMembership }));

import { getOutcomeSignalEvidence, publishOutcomeSignal } from "./outcomeSignals";

describe("outcome signal publication", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireMembership.mockResolvedValue({ membership: { role: "owner" } }); });

  it("rejects a requested outcome that is absent from the owned purchase list", async () => {
    mocks.purchases.mockResolvedValue([]);
    await expect(publishOutcomeSignal(4, 9, 77)).rejects.toThrow("Purchase outcome not found");
    expect(mocks.createContract).not.toHaveBeenCalled();
  });

  it("publishes a reference-only signal without client, customer reference, or internal notes", async () => {
    const outcome = { id: 77, offerName: "Growth system", amountCents: 15_000, currency: "USD", acquisitionChannel: "Meta", outcome: "completed", purchaseDate: "2026-08-01", campaignId: 88, clientId: 99, customerReference: "order-123", notes: "Private call notes" };
    mocks.purchases.mockResolvedValue([outcome]);
    mocks.createContract.mockImplementation(async (_userId: number, input: any) => ({ id: 71, workspaceId: input.workspaceId, status: input.status, createdAt: new Date(), payloadJson: JSON.stringify(input.payload) }));
    const signal = await publishOutcomeSignal(4, 9, 77);
    expect(signal.payload).toMatchObject({ purchaseOutcomeId: 77, offerName: "Growth system", amountCents: 15_000, campaignId: 88 });
    expect(JSON.stringify(signal.payload)).not.toContain("order-123");
    expect(JSON.stringify(signal.payload)).not.toContain("Private call notes");
    expect(JSON.stringify(signal.payload)).not.toContain("clientId");
  });

  it("labels shared signals as provenance only so they are not reused as revenue totals", async () => {
    mocks.listContracts.mockResolvedValue([{ id: 71, workspaceId: 9, sourceModule: "pulseforge", targetModule: "launchpro", contractType: "outcome_signal", status: "approved", payloadJson: JSON.stringify({ purchaseOutcomeId: 77, offerName: "Growth system", amountCents: 15_000, currency: "USD", acquisitionChannel: "Meta", outcome: "completed", purchaseDate: "2026-08-01", campaignId: 88, publishedAt: "2026-08-02T00:00:00.000Z" }), createdAt: new Date() }]);
    await expect(getOutcomeSignalEvidence(4, 9)).resolves.toMatchObject({ signalCount: 1, signals: [{ purchaseOutcomeId: 77 }], use: expect.stringContaining("Do not add") });
  });
});
