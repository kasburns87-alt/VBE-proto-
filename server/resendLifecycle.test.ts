import { describe, expect, it } from "vitest";
import { getHeaderValue, mapResendLifecycleEvent, replyCandidates, suppressionReasonForLifecycle } from "./resendLifecycle";

describe("native Resend lifecycle mapping", () => {
  it("maps lifecycle events without treating unknown events as delivery success", () => {
    expect(mapResendLifecycleEvent("email.delivered")).toBe("delivered");
    expect(mapResendLifecycleEvent("email.complained")).toBe("complained");
    expect(mapResendLifecycleEvent("email.received")).toBeNull();
  });

  it("turns bounce, complaint, and provider suppression events into non-sendable reasons", () => {
    expect(suppressionReasonForLifecycle("bounced")).toBe("bounce");
    expect(suppressionReasonForLifecycle("complained")).toBe("complaint");
    expect(suppressionReasonForLifecycle("suppressed")).toBe("manual");
    expect(suppressionReasonForLifecycle("delivered")).toBeNull();
  });

  it("finds case-insensitive reply headers and prioritizes direct parents before historical references", () => {
    const headers = { "In-Reply-To": "<parent@reply.example>", References: "<first@reply.example> <parent@reply.example>" };
    expect(getHeaderValue(headers, "in-reply-to")).toBe("<parent@reply.example>");
    expect(replyCandidates(getHeaderValue(headers, "in-reply-to"), getHeaderValue(headers, "references"))).toEqual(["<parent@reply.example>", "<parent@reply.example>", "<first@reply.example>"]);
  });
});
