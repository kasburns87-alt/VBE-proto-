import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { createUnsubscribeUrl, emailProviderConfigured, verifyUnsubscribeSignature } from "./email";

const original = {
  cookieSecret: ENV.cookieSecret,
  publicAppUrl: ENV.publicAppUrl,
  resendApiKey: ENV.resendApiKey,
  resendFromEmail: ENV.resendFromEmail,
  resendDeliveryApproved: ENV.resendDeliveryApproved,
};

afterEach(() => Object.assign(ENV, original));

describe("native Resend safety gates", () => {
  it("keeps delivery disabled until credentials and explicit approval are both present", () => {
    Object.assign(ENV, { resendApiKey: "re_test", resendFromEmail: "reports@reply.example.com", resendDeliveryApproved: false });
    expect(emailProviderConfigured()).toBe(false);
    ENV.resendDeliveryApproved = true;
    expect(emailProviderConfigured()).toBe(true);
  });

  it("creates recipient-bound signed unsubscribe links that reject tampering", () => {
    Object.assign(ENV, { cookieSecret: "test-secret", publicAppUrl: "https://pulseforge.example.com" });
    const url = createUnsubscribeUrl(42, "Client@Example.com");
    expect(url).toContain("/api/unsubscribe");
    const parsed = new URL(url!);
    expect(verifyUnsubscribeSignature(42, "client@example.com", parsed.searchParams.get("s") || "")).toBe(true);
    expect(verifyUnsubscribeSignature(42, "other@example.com", parsed.searchParams.get("s") || "")).toBe(false);
  });
});
