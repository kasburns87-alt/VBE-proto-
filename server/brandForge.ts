import { listModuleIntegrationContracts, createModuleIntegrationContract, setModuleIntegrationContractStatus } from "./workspaces";

export type BrandProfilePayload = {
  brandName: string;
  positioning: string;
  brandVoice: string;
  visualDirection: string;
  messagingPillars: string[];
  guardrails?: string;
};

export type BrandAssetPayload = {
  assetName: string;
  assetVersion: string;
  assetUrl: string;
  assetType: "logo" | "image" | "video" | "template" | "guideline";
  usageNotes?: string;
  rightsStatus: "approved" | "restricted";
};

function parsePayload<T>(payloadJson: string): T | null {
  try { return JSON.parse(payloadJson) as T; } catch { return null; }
}

function toReference<T>(contract: { id: number; workspaceId: number; status: string; contractVersion: string; createdAt: Date; updatedAt: Date; payloadJson: string }) {
  const payload = parsePayload<T>(contract.payloadJson);
  if (!payload) throw new Error("A stored BrandForge reference is invalid.");
  return { id: contract.id, workspaceId: contract.workspaceId, status: contract.status as "draft" | "approved" | "rejected" | "superseded", contractVersion: contract.contractVersion, createdAt: contract.createdAt, updatedAt: contract.updatedAt, payload };
}

export async function listBrandForgeProfiles(userId: number, workspaceId: number) {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  return contracts.filter(contract => contract.sourceModule === "brandforge" && contract.contractType === "brand_profile_snapshot")
    .map(contract => toReference<BrandProfilePayload>(contract));
}

export async function listBrandForgeAssets(userId: number, workspaceId: number) {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  return contracts.filter(contract => contract.sourceModule === "brandforge" && contract.contractType === "brand_asset_reference")
    .map(contract => toReference<BrandAssetPayload>(contract));
}

export async function saveBrandForgeProfile(userId: number, input: { workspaceId: number; payload: BrandProfilePayload; correlationId: string; idempotencyKey: string }) {
  return createModuleIntegrationContract(userId, {
    workspaceId: input.workspaceId,
    sourceModule: "brandforge",
    targetModule: "pulseforge",
    contractType: "brand_profile_snapshot",
    contractVersion: "v1",
    entityType: "brand_profile",
    entityId: input.payload.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100) || "brand-profile",
    status: "draft",
    payload: input.payload,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveBrandForgeAsset(userId: number, input: { workspaceId: number; payload: BrandAssetPayload; correlationId: string; idempotencyKey: string }) {
  return createModuleIntegrationContract(userId, {
    workspaceId: input.workspaceId,
    sourceModule: "brandforge",
    targetModule: "pulseforge",
    contractType: "brand_asset_reference",
    contractVersion: "v1",
    entityType: "brand_asset",
    entityId: `${input.payload.assetName}-${input.payload.assetVersion}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 180) || "brand-asset",
    status: "draft",
    payload: input.payload,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setBrandForgeReferenceStatus(userId: number, workspaceId: number, contractId: number, status: "approved" | "rejected" | "superseded") {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  const reference = contracts.find(contract => contract.id === contractId && contract.sourceModule === "brandforge" && (contract.contractType === "brand_profile_snapshot" || contract.contractType === "brand_asset_reference"));
  if (!reference) throw new Error("BrandForge reference not found in this workspace.");
  return setModuleIntegrationContractStatus(userId, workspaceId, contractId, status);
}

export async function resolveApprovedBrandForgeContext(userId: number, workspaceId: number, profileId?: number, assetIds: number[] = []) {
  const [profiles, assets] = await Promise.all([listBrandForgeProfiles(userId, workspaceId), listBrandForgeAssets(userId, workspaceId)]);
  const selectedProfile = profileId ? profiles.find(profile => profile.id === profileId) : undefined;
  if (profileId && (!selectedProfile || selectedProfile.status !== "approved")) throw new Error("Select an approved BrandForge profile before using it in a campaign.");
  const selectedAssets = assetIds.map(id => assets.find(asset => asset.id === id));
  if (selectedAssets.some(asset => !asset || asset.status !== "approved" || asset.payload.rightsStatus !== "approved")) throw new Error("Only approved BrandForge asset references with approved usage rights can be used in a campaign.");
  if (!selectedProfile && !selectedAssets.length) return undefined;
  return {
    profile: selectedProfile ? { contractId: selectedProfile.id, version: selectedProfile.contractVersion, ...selectedProfile.payload } : undefined,
    assets: selectedAssets.map(asset => ({
      contractId: asset!.id,
      version: asset!.contractVersion,
      assetName: asset!.payload.assetName,
      assetVersion: asset!.payload.assetVersion,
      assetType: asset!.payload.assetType,
      usageNotes: asset!.payload.usageNotes,
      rightsStatus: asset!.payload.rightsStatus,
    })),
  };
}
