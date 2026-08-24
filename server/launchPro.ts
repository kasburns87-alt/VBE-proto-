import { getCampaignWithAssets } from "./db";
import { createModuleIntegrationContract, listModuleIntegrationContracts, requireWorkspaceMembership } from "./workspaces";

type ContractRow = Awaited<ReturnType<typeof listModuleIntegrationContracts>>[number];

function parsePayload<T>(payloadJson: string): T | null {
  try { return JSON.parse(payloadJson) as T; } catch { return null; }
}

export type LaunchManifestPayload = {
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  platforms: string[];
  assetManifest: Array<{ assetId: number; label: string; assetType: string; format: string; mimeType: string; width?: number | null; height?: number | null }>;
  brandForgeEvidence?: unknown;
  generatedAt: string;
};

export type LaunchDecisionPayload = {
  manifestContractId: number;
  decision: "approved" | "rejected";
  rationale?: string;
  recordedAt: string;
};

function toManifest(contract: ContractRow) {
  const payload = parsePayload<LaunchManifestPayload>(contract.payloadJson);
  if (!payload) throw new Error("A stored LaunchPro manifest is invalid.");
  return { id: contract.id, workspaceId: contract.workspaceId, status: contract.status, contractVersion: contract.contractVersion, createdAt: contract.createdAt, updatedAt: contract.updatedAt, payload };
}

function toDecision(contract: ContractRow) {
  const payload = parsePayload<LaunchDecisionPayload>(contract.payloadJson);
  if (!payload) throw new Error("A stored LaunchPro decision is invalid.");
  return { id: contract.id, workspaceId: contract.workspaceId, status: contract.status, createdAt: contract.createdAt, payload };
}

export async function createLaunchProManifest(userId: number, workspaceId: number, campaignId: number) {
  await requireWorkspaceMembership(userId, workspaceId, ["owner", "admin"]);
  const campaign = await getCampaignWithAssets(userId, campaignId);
  if (!campaign || campaign.workspaceId !== workspaceId) throw new Error("Campaign not found in this workspace.");
  if (campaign.status !== "complete") throw new Error("Complete campaign generation before creating a LaunchPro manifest.");
  const output = parsePayload<Record<string, unknown>>(campaign.insightsJson || "") || {};
  const payload: LaunchManifestPayload = {
    campaignId: campaign.id,
    campaignName: campaign.campaignName || campaign.productName,
    campaignStatus: campaign.status,
    platforms: parsePayload<string[]>(campaign.platforms) || [],
    assetManifest: campaign.assets.map(asset => ({ assetId: asset.id, label: asset.label, assetType: asset.assetType, format: asset.format, mimeType: asset.mimeType, width: asset.width, height: asset.height })),
    brandForgeEvidence: output.brandForgeEvidence,
    generatedAt: new Date().toISOString(),
  };
  const version = campaign.updatedAt.getTime();
  const contract = await createModuleIntegrationContract(userId, {
    workspaceId,
    sourceModule: "pulseforge",
    targetModule: "launchpro",
    contractType: "campaign_pack_manifest",
    contractVersion: "v1",
    entityType: "campaign",
    entityId: String(campaign.id),
    status: "draft",
    payload,
    correlationId: `campaign-${campaign.id}-${version}`,
    idempotencyKey: `launchpro-manifest-${campaign.id}-${version}`,
  });
  return toManifest(contract);
}

export async function listLaunchProManifests(userId: number, workspaceId: number) {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  return contracts.filter(contract => contract.sourceModule === "pulseforge" && contract.targetModule === "launchpro" && contract.contractType === "campaign_pack_manifest").map(toManifest);
}

export async function recordLaunchProDecision(userId: number, input: { workspaceId: number; manifestContractId: number; decision: "approved" | "rejected"; rationale?: string; correlationId: string; idempotencyKey: string }) {
  await requireWorkspaceMembership(userId, input.workspaceId, ["owner", "admin"]);
  const manifests = await listLaunchProManifests(userId, input.workspaceId);
  const manifest = manifests.find(item => item.id === input.manifestContractId);
  if (!manifest) throw new Error("LaunchPro manifest not found in this workspace.");
  const contract = await createModuleIntegrationContract(userId, {
    workspaceId: input.workspaceId,
    sourceModule: "launchpro",
    targetModule: "pulseforge",
    contractType: "approval_decision",
    contractVersion: "v1",
    entityType: "campaign_pack_manifest",
    entityId: String(manifest.id),
    status: input.decision,
    payload: { manifestContractId: manifest.id, decision: input.decision, rationale: input.rationale, recordedAt: new Date().toISOString() } satisfies LaunchDecisionPayload,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
  });
  return toDecision(contract);
}

export async function getLaunchProReadiness(userId: number, workspaceId: number, campaignId: number) {
  const manifests = await listLaunchProManifests(userId, workspaceId);
  const manifest = manifests.find(item => item.payload.campaignId === campaignId);
  if (!manifest) return { manifest: null, decision: null, approved: false };
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  const decisionContracts = contracts.filter(contract => contract.sourceModule === "launchpro" && contract.targetModule === "pulseforge" && contract.contractType === "approval_decision" && contract.entityType === "campaign_pack_manifest" && contract.entityId === String(manifest.id));
  const decision = decisionContracts.length ? toDecision(decisionContracts[0]) : null;
  return { manifest, decision, approved: decision?.payload.decision === "approved" && decision.status === "approved" };
}
