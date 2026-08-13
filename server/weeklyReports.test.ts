import { describe, expect, it } from "vitest";
import { renderWeeklyAnalyticsPdf } from "./weeklyReports";

describe("weekly analytics PDF", () => {
  it("renders a valid PDF even when a reporting period has no verified snapshots", async () => {
    const pdf = await renderWeeklyAnalyticsPdf({
      title: "Weekly performance summary",
      recipientName: "Client Team",
      periodStart: "2026-08-03",
      periodEnd: "2026-08-09",
      summary: { snapshotCount: 0, totals: {}, platforms: [], campaigns: [] } as any,
    });

    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
