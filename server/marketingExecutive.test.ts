import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), reserveUsage: vi.fn(), snapshots: vi.fn(), purchases: vi.fn(), outcomeSignals: vi.fn(), workspaces: vi.fn(), llm: vi.fn(), dataApi: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, reserveMonthlyUsage: mocks.reserveUsage, getAnalyticsSnapshotsForUser: mocks.snapshots }));
vi.mock("./analytics", () => ({ summarizeAnalytics: vi.fn(() => ({ snapshotCount: 0, totals: {}, platforms: [], campaigns: [] })) }));
vi.mock("./purchaseIntelligence", () => ({ getPurchaseIntelligence: mocks.purchases }));
vi.mock("./outcomeSignals", () => ({ getOutcomeSignalEvidence: mocks.outcomeSignals }));
vi.mock("./workspaces", () => ({ listWorkspacesForUser: mocks.workspaces }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./_core/dataApi", () => ({ callDataApi: mocks.dataApi }));

import { getMarketSignals, runMarketingExecutive } from "./marketingExecutive";

function emptyDb() {
  return { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) };
}

function executiveDb(profile: any, run: any) {
  const results = [[profile], [run]];
  let index = 0;
  const inserts: any[] = [];
  return {
    inserts,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => results[index++] || [],
          orderBy: () => ({ limit: async () => results[index++] || [] }),
        }),
      }),
    }),
    insert: () => ({ values: async (value: any) => { inserts.push(value); } }),
  };
}

describe("marketing executive", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.getDb.mockResolvedValue(emptyDb());
    mocks.workspaces.mockResolvedValue([]);
    mocks.outcomeSignals.mockResolvedValue({ workspaceId: null, signalCount: 0, signals: [], use: "No workspace-scoped outcome signals are available." });
  });

  it("requires a saved business profile before consuming LLM or research usage", async () => {
    await expect(runMarketingExecutive({ userId: 3, prompt: "Create a new campaign direction", runType: "campaign_plan" })).rejects.toThrow("business intelligence profile");
    expect(mocks.reserveUsage).not.toHaveBeenCalled();
    expect(mocks.llm).not.toHaveBeenCalled();
    expect(mocks.dataApi).not.toHaveBeenCalled();
  });

  it("returns source-attributed market signal fallbacks instead of inventing a trend claim", async () => {
    mocks.dataApi.mockResolvedValueOnce({ visits: 100 }).mockRejectedValueOnce(new Error("No engagement data")).mockResolvedValueOnce({ channels: [] });
    const signals = await getMarketSignals("example.com");
    expect(signals.domain).toBe("example.com");
    expect(signals.sources).toHaveLength(3);
    expect(signals.sources.map(source => source.status)).toEqual(["available", "unavailable", "available"]);
    expect(signals.sources[1].source).toContain("bounce rate");
  });

  it("persists a one-prompt recommendation with verified analytics and named source evidence", async () => {
    const profile = { id: 12, userId: 3, businessName: "Luma", websiteDomain: "luma.example", industry: "Wellness", coreOffer: "Daily skin recovery", targetAudience: "Busy professionals", brandVoice: "Clear and warm", differentiators: null, strategicGoals: null, marketContext: null, guardrails: null };
    const run = { id: 44, userId: 3, prompt: "What should we test next?", runType: "campaign_plan" };
    const db = executiveDb(profile, run);
    mocks.getDb.mockResolvedValue(db);
    mocks.snapshots.mockResolvedValue([]);
    mocks.purchases.mockResolvedValue({ purchaseCount: 2, completedCount: 1, refundedCount: 1, completedRevenueCents: 15_000, refundedCents: 5_000, netRevenueCents: 10_000, topOffers: [{ label: "Recovery plan", count: 2, netCents: 10_000 }], topChannels: [{ label: "Meta", count: 2, netCents: 10_000 }] });
    mocks.workspaces.mockResolvedValue([{ workspace: { id: 9 } }]);
    mocks.outcomeSignals.mockResolvedValue({ workspaceId: 9, signalCount: 1, signals: [{ contractId: 71, purchaseOutcomeId: 4, offerName: "Recovery plan", outcome: "completed" }], use: "Audit provenance only. Do not add to revenue totals." });
    mocks.dataApi.mockResolvedValue({ metric: "available" });
    mocks.llm.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ executiveSummary: "Test a focused offer", whatIsWorking: [], watchouts: [], nextMove: { title: "Test", rationale: "No verified snapshots are available.", priority: "now" }, campaignMaterial: { concept: "Recovery routine", headline: "Your reset starts here", primaryText: "A daily recovery ritual.", cta: "Learn more", hashtags: ["#recovery"] }, researchBrief: { recommendedQuery: "wellness recovery trends", sourceNeed: "Verify demand with named sources", caveat: "No performance result is claimed." } }) } }] });

    const result = await runMarketingExecutive({ userId: 3, prompt: "What should we test next?", runType: "campaign_plan" });

    expect(mocks.reserveUsage).toHaveBeenCalledWith(3, "assistantRequests");
    expect(result.evidence.verifiedAnalytics.snapshotCount).toBe(0);
    expect(result.evidence.purchaseIntelligence.netRevenueCents).toBe(10_000);
    expect(result.evidence.outcomeSignalEvidence).toMatchObject({ workspaceId: 9, signalCount: 1 });
    expect(result.evidence.marketSignals.sources).toHaveLength(3);
    expect(db.inserts[0].evidenceJson).toContain("Similarweb total visits");
    expect(mocks.llm.mock.calls[0][0].messages[1].content).toContain("Source-attributed market signals");
    expect(mocks.llm.mock.calls[0][0].messages[1].content).toContain("Verified purchase outcomes");
    expect(mocks.llm.mock.calls[0][0].messages[1].content).toContain("do not add to revenue totals");
  });
});
