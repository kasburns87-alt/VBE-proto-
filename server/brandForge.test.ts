import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listContracts: vi.fn(), createContract: vi.fn(), setContractStatus: vi.fn() }));
vi.mock("./workspaces", () => ({
  listModuleIntegrationContracts: mocks.listContracts,
  createModuleIntegrationContract: mocks.createContract,
  setModuleIntegrationContractStatus: mocks.setContractStatus,
}));

import { listApprovedBrandForgeProfiles, resolveApprovedBrandForgeContext, setBrandForgeReferenceStatus } from "./brandForge";

function contract(overrides: Record<string, unknown>) {
  return {
    id: 1,
    workspaceId: 9,
    sourceModule: "brandforge",
    targetModule: "pulseforge",
    contractType: "brand_profile_snapshot",
    contractVersion: "v1",
    status: "approved",
    payloadJson: JSON.stringify({ brandName: "VBE", positioning: "Business infrastructure", brandVoice: "Premium", visualDirection: "Blush editorial", messagingPillars: ["Control"] }),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("BrandForge approval boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a selected draft profile from campaign context", async () => {
    mocks.listContracts.mockResolvedValue([contract({ status: "draft" })]);
    await expect(resolveApprovedBrandForgeContext(4, 9, 1)).rejects.toThrow("approved BrandForge profile");
  });

  it("rejects a restricted asset even when its contract is approved", async () => {
    mocks.listContracts.mockResolvedValue([contract({ id: 2, contractType: "brand_asset_reference", payloadJson: JSON.stringify({ assetName: "Logo", assetVersion: "v1", assetUrl: "https://brand.example/logo.svg", assetType: "logo", rightsStatus: "restricted" }) })]);
    await expect(resolveApprovedBrandForgeContext(4, 9, undefined, [2])).rejects.toThrow("approved usage rights");
  });

  it("returns a profile and reference names only when all selected contracts are approved", async () => {
    mocks.listContracts.mockResolvedValue([
      contract({ id: 1 }),
      contract({ id: 2, contractType: "brand_asset_reference", payloadJson: JSON.stringify({ assetName: "Hero image", assetVersion: "v3", assetUrl: "https://brand.example/hero.jpg", assetType: "image", rightsStatus: "approved", usageNotes: "Direction only" }) }),
    ]);
    const context = await resolveApprovedBrandForgeContext(4, 9, 1, [2]);
    expect(context).toMatchObject({ profile: { contractId: 1, brandName: "VBE" }, assets: [{ contractId: 2, assetName: "Hero image", rightsStatus: "approved" }] });
    expect(JSON.stringify(context)).not.toContain("https://brand.example/hero.jpg");
  });

  it("exposes only approved profiles to the executive-prefill retrieval path", async () => {
    mocks.listContracts.mockResolvedValue([
      contract({ id: 1, status: "approved" }),
      contract({ id: 2, status: "draft" }),
      contract({ id: 3, status: "rejected" }),
      contract({ id: 4, status: "superseded" }),
    ]);
    await expect(listApprovedBrandForgeProfiles(4, 9)).resolves.toMatchObject([{ id: 1, status: "approved" }]);
  });

  it("does not let the BrandForge status control mutate a non-BrandForge contract", async () => {
    mocks.listContracts.mockResolvedValue([contract({ id: 7, sourceModule: "pulseforge", contractType: "campaign_pack_manifest" })]);
    await expect(setBrandForgeReferenceStatus(4, 9, 7, "approved")).rejects.toThrow("BrandForge reference not found");
    expect(mocks.setContractStatus).not.toHaveBeenCalled();
  });
});
