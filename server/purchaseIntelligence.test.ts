import { describe, expect, it } from "vitest";
import { summarizePurchaseOutcomes } from "./purchaseIntelligence";

describe("purchase intelligence", () => {
  it("nets refunds without treating cancelled purchases as revenue and ranks offer and channel evidence", () => {
    const summary = summarizePurchaseOutcomes([
      { offerName: "Growth plan", acquisitionChannel: "Meta paid social", amountCents: 15_000, outcome: "completed" },
      { offerName: "Growth plan", acquisitionChannel: "Meta paid social", amountCents: 5_000, outcome: "refunded" },
      { offerName: "Strategy session", acquisitionChannel: "Organic search", amountCents: 8_000, outcome: "completed" },
      { offerName: "Growth plan", acquisitionChannel: "Meta paid social", amountCents: 9_000, outcome: "cancelled" },
    ]);

    expect(summary).toMatchObject({ purchaseCount: 4, completedCount: 2, refundedCount: 1, completedRevenueCents: 23_000, refundedCents: 5_000, netRevenueCents: 18_000 });
    expect(summary.topOffers[0]).toEqual({ label: "Growth plan", count: 3, netCents: 10_000 });
    expect(summary.topChannels[0]).toEqual({ label: "Meta paid social", count: 3, netCents: 10_000 });
  });
});
