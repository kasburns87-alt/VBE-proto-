import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listContracts: vi.fn() }));
vi.mock("./workspaces", () => ({ listModuleIntegrationContracts: mocks.listContracts }));

import { listIntegrationLedger } from "./integrationLedger";

describe("integration audit ledger", () => {
  beforeEach(() => vi.clearAllMocks());

  it("propagates workspace membership denial instead of returning a cross-workspace ledger", async () => {
    mocks.listContracts.mockRejectedValue(new Error("You do not have access to this workspace."));
    await expect(listIntegrationLedger(4, 99)).rejects.toThrow("do not have access");
  });

  it("returns a sanitized summary rather than raw asset, customer, or notes payload values", async () => {
    mocks.listContracts.mockResolvedValue([
      { id: 1, workspaceId: 9, sourceModule: "brandforge", targetModule: "pulseforge", contractType: "brand_asset_reference", contractVersion: "v1", status: "approved", entityType: "brand_asset", entityId: "hero-v1", correlationId: "brand-asset-1", createdAt: new Date(), updatedAt: new Date(), payloadJson: JSON.stringify({ assetName: "Hero", assetType: "image", assetVersion: "v1", rightsStatus: "approved", assetUrl: "https://private.example/asset.png", customerReference: "do-not-leak", notes: "private" }) },
      { id: 2, workspaceId: 9, sourceModule: "pulseforge", targetModule: "launchpro", contractType: "outcome_signal", contractVersion: "v1", status: "approved", entityType: "purchase_outcome", entityId: "7", correlationId: "outcome-7", createdAt: new Date(), updatedAt: new Date(), payloadJson: JSON.stringify({ purchaseOutcomeId: 7, offerName: "Growth system", acquisitionChannel: "Meta", outcome: "completed", amountCents: 15_000, customerReference: "do-not-leak", notes: "private" }) },
    ]);
    const rows = await listIntegrationLedger(4, 9);
    expect(rows).toHaveLength(2);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("private.example");
    expect(serialized).not.toContain("do-not-leak");
    expect(serialized).not.toContain("private\"");
    expect(rows[0].summary).toMatchObject({ label: "Hero", detail: "image · v1 · approved" });
  });

  it("filters by a participating module, contract type, and approval state", async () => {
    mocks.listContracts.mockResolvedValue([
      { id: 1, workspaceId: 9, sourceModule: "brandforge", targetModule: "pulseforge", contractType: "brand_profile_snapshot", contractVersion: "v1", status: "approved", entityType: "brand", entityId: "vbe", correlationId: "brand-1", createdAt: new Date(), updatedAt: new Date(), payloadJson: JSON.stringify({ brandName: "VBE", brandVoice: "Premium" }) },
      { id: 2, workspaceId: 9, sourceModule: "pulseforge", targetModule: "launchpro", contractType: "campaign_pack_manifest", contractVersion: "v1", status: "draft", entityType: "campaign", entityId: "88", correlationId: "campaign-88", createdAt: new Date(), updatedAt: new Date(), payloadJson: JSON.stringify({ campaignId: 88, campaignName: "Launch", platforms: ["meta"], assetManifest: [] }) },
    ]);
    await expect(listIntegrationLedger(4, 9, { module: "launchpro", contractType: "campaign_pack_manifest", status: "draft" })).resolves.toMatchObject([{ id: 2 }]);
  });
});
