import { listModuleIntegrationContracts } from "./workspaces";

export type LedgerFilter = {
  module?: "all" | "brandforge" | "pulseforge" | "launchpro";
  contractType?: "all" | "brand_profile_snapshot" | "brand_asset_reference" | "campaign_pack_manifest" | "approval_decision" | "outcome_signal";
  status?: "all" | "draft" | "approved" | "rejected" | "superseded";
};

function parsePayload(value: string) { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
function string(value: unknown) { return typeof value === "string" ? value : undefined; }
function number(value: unknown) { return typeof value === "number" ? value : undefined; }

function safeSummary(contract: { contractType: string; payloadJson: string }) {
  const payload = parsePayload(contract.payloadJson);
  switch (contract.contractType) {
    case "brand_profile_snapshot": return { label: string(payload.brandName) || "Brand profile", detail: string(payload.brandVoice) || "Creative profile", references: [] };
    case "brand_asset_reference": return { label: string(payload.assetName) || "Brand asset", detail: [string(payload.assetType), string(payload.assetVersion), string(payload.rightsStatus)].filter(Boolean).join(" · ") || "Asset reference", references: [] };
    case "campaign_pack_manifest": {
      const platforms = Array.isArray(payload.platforms) ? payload.platforms.filter(item => typeof item === "string").join(", ") : "";
      const assets = Array.isArray(payload.assetManifest) ? payload.assetManifest.length : 0;
      return { label: string(payload.campaignName) || "Campaign pack", detail: `${platforms || "No platforms"} · ${assets} asset references`, references: [number(payload.campaignId)].filter((value): value is number => value !== undefined) };
    }
    case "approval_decision": return { label: `${string(payload.decision) || "Recorded"} decision`, detail: string(payload.rationale)?.slice(0, 240) || "No rationale recorded.", references: [number(payload.manifestContractId)].filter((value): value is number => value !== undefined) };
    case "outcome_signal": return { label: string(payload.offerName) || "Outcome signal", detail: [string(payload.acquisitionChannel) || "Unattributed", string(payload.outcome) || "Recorded"].join(" · "), references: [number(payload.purchaseOutcomeId), number(payload.campaignId)].filter((value): value is number => value !== undefined) };
    default: return { label: "Integration contract", detail: "Sanitized contract summary", references: [] };
  }
}

export async function listIntegrationLedger(userId: number, workspaceId: number, filter: LedgerFilter = {}) {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  return contracts.filter(contract => {
    const moduleMatch = !filter.module || filter.module === "all" || contract.sourceModule === filter.module || contract.targetModule === filter.module;
    const typeMatch = !filter.contractType || filter.contractType === "all" || contract.contractType === filter.contractType;
    const statusMatch = !filter.status || filter.status === "all" || contract.status === filter.status;
    return moduleMatch && typeMatch && statusMatch;
  }).map(contract => ({
    id: contract.id,
    workspaceId: contract.workspaceId,
    sourceModule: contract.sourceModule,
    targetModule: contract.targetModule,
    contractType: contract.contractType,
    contractVersion: contract.contractVersion,
    status: contract.status,
    entityType: contract.entityType,
    entityId: contract.entityId,
    correlationId: contract.correlationId,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    summary: safeSummary(contract),
  }));
}
