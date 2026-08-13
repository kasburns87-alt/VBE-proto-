import { describe, expect, it } from "vitest";
import { createNativeMessageIdentifiers, getHeaderValue, mapResendLifecycleEvent, replyCandidates, shouldProcessWebhookEvent, suppressionReasonForLifecycle } from "./resendLifecycle";

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

  it("derives the same provider message identity for retry-safe sends and retains explicit reply threading", () => {
    const first = createNativeMessageIdentifiers({ userId: 7, idempotencyKey: "client-email:7:abc", senderDomain: "reply.example.com" });
    const retry = createNativeMessageIdentifiers({ userId: 7, idempotencyKey: "client-email:7:abc", senderDomain: "reply.example.com" });
    const reply = createNativeMessageIdentifiers({ userId: 7, idempotencyKey: "client-email:7:def", senderDomain: "reply.example.com", inReplyTo: first.messageId });
    expect(retry.messageId).toBe(first.messageId);
    expect(reply.threadKey).toBe(first.messageId);
    expect(reply.referencesHeader).toBe(first.messageId);
  });

  it("processes a provider webhook event once and rejects its replay decision", () => {
    expect(shouldProcessWebhookEvent(true)).toBe(true);
    expect(shouldProcessWebhookEvent(false)).toBe(false);
  });
});
