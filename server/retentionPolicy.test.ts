import { describe, expect, it } from "vitest";
import { retentionCutoffs } from "./clientOps";

describe("client operations retention policy", () => {
  it("derives independent, deterministic communication and report record cutoffs", () => {
    const reference = new Date("2026-08-13T00:00:00.000Z");
    const cutoffs = retentionCutoffs({ communicationRetentionDays: 30, reportRetentionDays: 90 }, reference);
    expect(cutoffs.communicationCutoff.toISOString()).toBe("2026-07-14T00:00:00.000Z");
    expect(cutoffs.reportCutoff.toISOString()).toBe("2026-05-15T00:00:00.000Z");
  });

  it("uses a conservative 365-day default when no retention setting exists", () => {
    const reference = new Date("2026-08-13T00:00:00.000Z");
    const cutoffs = retentionCutoffs(null, reference);
    expect(cutoffs.communicationCutoff.toISOString()).toBe("2025-08-13T00:00:00.000Z");
    expect(cutoffs.reportCutoff.toISOString()).toBe("2025-08-13T00:00:00.000Z");
  });
});
