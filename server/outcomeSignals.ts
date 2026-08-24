import { listPurchaseOutcomes } from "./purchaseIntelligence";
import { createModuleIntegrationContract, listModuleIntegrationContracts, requireWorkspaceMembership } from "./workspaces";

export type OutcomeSignalPayload = {
  purchaseOutcomeId: number;
  offerName: string;
  amountCents: number;
  currency: string;
  acquisitionChannel: string | null;
  outcome: string;
  purchaseDate: string;
  campaignId: number | null;
  publishedAt: string;
};

function parsePayload<T>(payloadJson: string): T | null {
  try { return JSON.parse(payloadJson) as T; } catch { return null; }
}

export async function publishOutcomeSignal(userId: number, workspaceId: number, purchaseOutcomeId: number) {
  await requireWorkspaceMembership(userId, workspaceId, ["owner", "admin"]);
  const outcomes = await listPurchaseOutcomes(userId);
  const outcome = outcomes.find(item => item.id === purchaseOutcomeId);
  if (!outcome) throw new Error("Purchase outcome not found.");
  const payload: OutcomeSignalPayload = {
    purchaseOutcomeId: outcome.id,
    offerName: outcome.offerName,
    amountCents: outcome.amountCents,
    currency: outcome.currency,
    acquisitionChannel: outcome.acquisitionChannel,
    outcome: outcome.outcome,
    purchaseDate: outcome.purchaseDate,
    campaignId: outcome.campaignId,
    publishedAt: new Date().toISOString(),
  };
  const contract = await createModuleIntegrationContract(userId, {
    workspaceId,
    sourceModule: "pulseforge",
    targetModule: "launchpro",
    contractType: "outcome_signal",
    contractVersion: "v1",
    entityType: "purchase_outcome",
    entityId: String(outcome.id),
    status: "approved",
    payload,
    correlationId: `purchase-outcome-${outcome.id}`,
    idempotencyKey: `launchpro-outcome-signal-${outcome.id}`,
  });
  return { id: contract.id, workspaceId: contract.workspaceId, status: contract.status, createdAt: contract.createdAt, payload };
}

export async function listOutcomeSignals(userId: number, workspaceId: number) {
  const contracts = await listModuleIntegrationContracts(userId, workspaceId);
  return contracts
    .filter(contract => contract.sourceModule === "pulseforge" && contract.targetModule === "launchpro" && contract.contractType === "outcome_signal" && contract.status === "approved")
    .map(contract => {
      const payload = parsePayload<OutcomeSignalPayload>(contract.payloadJson);
      if (!payload) throw new Error("A stored outcome signal is invalid.");
      return { id: contract.id, workspaceId: contract.workspaceId, status: contract.status, createdAt: contract.createdAt, payload };
    });
}

export async function getOutcomeSignalEvidence(userId: number, workspaceId?: number) {
  if (!workspaceId) return { workspaceId: null, signalCount: 0, signals: [], use: "No workspace-scoped outcome signals are available. Purchase intelligence remains the sole revenue source." };
  const signals = await listOutcomeSignals(userId, workspaceId);
  return {
    workspaceId,
    signalCount: signals.length,
    signals: signals.slice(0, 10).map(signal => ({ contractId: signal.id, purchaseOutcomeId: signal.payload.purchaseOutcomeId, offerName: signal.payload.offerName, acquisitionChannel: signal.payload.acquisitionChannel, outcome: signal.payload.outcome, purchaseDate: signal.payload.purchaseDate })),
    use: "Audit and cross-module provenance only. Do not add these signals to purchase revenue totals because they reference the same verified purchase outcomes.",
  };
}
