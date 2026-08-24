import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  reserveUsage: vi.fn(), createCampaign: vi.fn(), updateCampaign: vi.fn(), saveAssets: vi.fn(), getCampaign: vi.fn(),
  workspace: vi.fn(), resolveContext: vi.fn(), blueprint: vi.fn(), images: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  reserveMonthlyUsage: mocks.reserveUsage,
  createCampaign: mocks.createCampaign,
  updateCampaignOutput: mocks.updateCampaign,
  saveCampaignAssets: mocks.saveAssets,
  getCampaignWithAssets: mocks.getCampaign,
}));
vi.mock("./workspaces", async importOriginal => ({ ...(await importOriginal<typeof import("./workspaces")>()), getOrCreateDefaultWorkspace: mocks.workspace }));
vi.mock("./brandForge", async importOriginal => ({ ...(await importOriginal<typeof import("./brandForge")>()), resolveApprovedBrandForgeContext: mocks.resolveContext }));
vi.mock("./campaign", async importOriginal => ({ ...(await importOriginal<typeof import("./campaign")>()), generateCampaignBlueprint: mocks.blueprint, generateCampaignImages: mocks.images }));

import { appRouter } from "./routers";

const baseBrief = { productName: "Growth system", industry: "Business services", targetAudience: "Founders who need a calmer, more structured operating system.", goal: "Drive conversions", tone: "Refined and premium", platforms: ["meta"] as const };
const user = { id: 4, openId: "owner", name: "Casey", email: null, loginMethod: null, role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("campaign BrandForge handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reserveUsage.mockResolvedValue(undefined);
    mocks.workspace.mockResolvedValue({ workspace: { id: 9 }, membership: { role: "owner" } });
    mocks.createCampaign.mockResolvedValue({ id: 88 });
    mocks.images.mockResolvedValue([]);
    mocks.getCampaign.mockResolvedValue({ id: 88, assets: [] });
    mocks.blueprint.mockResolvedValue({ campaignName: "System launch", executiveAngle: "Control", trendInsights: [], targeting: { coreAudience: "Founders", segments: [], exclusions: [], placements: [] }, strategy: { objective: "Conversion", hook: "Control", offer: "System", ctaStrategy: "Apply", testingPlan: [] }, platforms: { meta: {}, tiktok: {}, youtube: {} } });
  });

  function caller() { return appRouter.createCaller({ user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] }); }

  it("rejects a draft BrandForge profile before creating a campaign", async () => {
    mocks.resolveContext.mockRejectedValue(new Error("Select an approved BrandForge profile before using it in a campaign."));
    await expect(caller().campaign.generate({ ...baseBrief, brandForgeProfileId: 11 })).rejects.toThrow("approved BrandForge profile");
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it("rejects restricted or unapproved asset references before creating a campaign", async () => {
    mocks.resolveContext.mockRejectedValue(new Error("Only approved BrandForge asset references with approved usage rights can be used in a campaign."));
    await expect(caller().campaign.generate({ ...baseBrief, brandForgeAssetIds: [22] })).rejects.toThrow("approved usage rights");
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it("persists approved reference evidence in both the campaign brief and generated insight evidence", async () => {
    const context = { profile: { contractId: 11, version: "v1", brandName: "VBE", positioning: "Infrastructure", brandVoice: "Premium", visualDirection: "Blush editorial", messagingPillars: ["Control"] }, assets: [{ contractId: 22, version: "v3", assetName: "Hero direction", assetVersion: "v3", assetType: "image", rightsStatus: "approved" as const }] };
    mocks.resolveContext.mockResolvedValue(context);
    await expect(caller().campaign.generate({ ...baseBrief, brandForgeProfileId: 11, brandForgeAssetIds: [22] })).resolves.toMatchObject({ id: 88 });
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 9, brandForgeContext: context }));
    expect(mocks.updateCampaign).toHaveBeenCalledWith(4, 88, expect.objectContaining({ status: "complete", insightsJson: expect.stringContaining("brandForgeEvidence") }));
  });
});
