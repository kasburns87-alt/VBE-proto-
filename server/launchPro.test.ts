import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCampaign: vi.fn(), createContract: vi.fn(), listContracts: vi.fn(), requireMembership: vi.fn() }));
vi.mock("./db", () => ({ getCampaignWithAssets: mocks.getCampaign }));
vi.mock("./workspaces", () => ({ createModuleIntegrationContract: mocks.createContract, listModuleIntegrationContracts: mocks.listContracts, requireWorkspaceMembership: mocks.requireMembership }));

import { createLaunchProManifest, getLaunchProReadiness, recordLaunchProDecision } from "./launchPro";

function manifestContract(overrides: Record<string, unknown> = {}) {
  return { id: 31, workspaceId: 9, sourceModule: "pulseforge", targetModule: "launchpro", contractType: "campaign_pack_manifest", contractVersion: "v1", status: "draft", payloadJson: JSON.stringify({ campaignId: 88, campaignName: "System launch", campaignStatus: "complete", platforms: ["meta"], assetManifest: [{ assetId: 4, label: "Meta Feed", assetType: "image", format: "Feed square", mimeType: "image/png" }], generatedAt: "2026-01-01T00:00:00.000Z" }), correlationId: "campaign-88", idempotencyKey: "manifest-88", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), ...overrides };
}

describe("LaunchPro campaign handoff", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireMembership.mockResolvedValue({ membership: { role: "owner" } }); });

  it("rejects a campaign outside the active workspace before creating a manifest", async () => {
    mocks.getCampaign.mockResolvedValue({ id: 88, workspaceId: 10, status: "complete" });
    await expect(createLaunchProManifest(4, 9, 88)).rejects.toThrow("not found in this workspace");
    expect(mocks.createContract).not.toHaveBeenCalled();
  });

  it("creates a reference-only manifest that does not include campaign asset URLs", async () => {
    const campaign = { id: 88, workspaceId: 9, status: "complete", campaignName: "System launch", productName: "System", platforms: JSON.stringify(["meta"]), insightsJson: JSON.stringify({ brandForgeEvidence: { profile: { contractId: 11 } } }), updatedAt: new Date("2026-01-02"), assets: [{ id: 4, label: "Meta Feed", assetType: "image", format: "Feed square", mimeType: "image/png", fileUrl: "https://private.example/signed.png", width: 1080, height: 1080 }] };
    mocks.getCampaign.mockResolvedValue(campaign);
    mocks.createContract.mockImplementation(async (_userId: number, input: any) => manifestContract({ payloadJson: JSON.stringify(input.payload) }));
    const result = await createLaunchProManifest(4, 9, 88);
    expect(result.payload.assetManifest).toEqual([expect.objectContaining({ assetId: 4, label: "Meta Feed" })]);
    expect(JSON.stringify(result.payload)).not.toContain("private.example");
    expect(mocks.createContract).toHaveBeenCalledWith(4, expect.objectContaining({ sourceModule: "pulseforge", targetModule: "launchpro", contractType: "campaign_pack_manifest", status: "draft" }));
  });

  it("treats an explicit approved LaunchPro decision as review readiness, not an autonomous action", async () => {
    const manifest = manifestContract();
    const decision = { id: 32, workspaceId: 9, sourceModule: "launchpro", targetModule: "pulseforge", contractType: "approval_decision", contractVersion: "v1", status: "approved", entityType: "campaign_pack_manifest", entityId: "31", payloadJson: JSON.stringify({ manifestContractId: 31, decision: "approved", rationale: "Owner confirmed", recordedAt: "2026-01-02T00:00:00.000Z" }), correlationId: "decision-31", idempotencyKey: "decision-31", createdAt: new Date("2026-01-02"), updatedAt: new Date("2026-01-02") };
    mocks.listContracts.mockResolvedValue([manifest, decision]);
    mocks.createContract.mockResolvedValue(decision);
    const recorded = await recordLaunchProDecision(4, { workspaceId: 9, manifestContractId: 31, decision: "approved", rationale: "Owner confirmed", correlationId: "correlation-31", idempotencyKey: "approval-decision-00031" });
    expect(recorded.payload.decision).toBe("approved");
    await expect(getLaunchProReadiness(4, 9, 88)).resolves.toMatchObject({ approved: true, manifest: { id: 31 }, decision: { id: 32 } });
  });
});
