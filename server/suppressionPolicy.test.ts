import { describe, expect, it } from "vitest";
import { assertRecipientCanReceiveEmail } from "./clientOps";

describe("suppression enforcement policy", () => {
  it("blocks the shared policy used by manual sends, scheduled follow-ups, and weekly report delivery", () => {
    const suppression = { reason: "unsubscribe" };
    expect(() => assertRecipientCanReceiveEmail(suppression)).toThrow("suppressed for unsubscribe");
  });

  it("permits a recipient only when no suppression state exists", () => {
    expect(() => assertRecipientCanReceiveEmail(null)).not.toThrow();
  });
});
