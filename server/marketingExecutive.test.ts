import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), reserveUsage: vi.fn(), snapshots: vi.fn(), llm: vi.fn(), dataApi: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, reserveMonthlyUsage: mocks.reserveUsage, getAnalyticsSnapshotsForUser: mocks.snapshots }));
vi.mock("./analytics", () => ({ summarizeAnalytics: vi.fn(() => ({ snapshotCount: 0, totals: {}, platforms: [], campaigns: [] })) }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./_core/dataApi", () => ({ callDataApi: mocks.dataApi }));

import { getMarketSignals, runMarketingExecutive } from "./marketingExecutive";

function emptyDb() {
  return { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) };
}

describe("marketing executive", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.getDb.mockResolvedValue(emptyDb());
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
});
