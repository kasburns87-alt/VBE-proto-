import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyWebhook: vi.fn(),
  retrieveInbound: vi.fn(),
  verifyUnsubscribe: vi.fn(),
  recordEvent: vi.fn(),
  finalizeEvent: vi.fn(),
  getByProvider: vi.fn(),
  getByMessage: vi.fn(),
  updateStatus: vi.fn(),
  upsertSuppression: vi.fn(),
  findInboundOwner: vi.fn(),
  findClientByEmail: vi.fn(),
  recordInbound: vi.fn(),
}));

vi.mock("./clientOps", () => ({
  finalizeEmailWebhookEvent: mocks.finalizeEvent,
  findClientByEmail: mocks.findClientByEmail,
  findInboundOwner: mocks.findInboundOwner,
  getCommunicationByMessageId: mocks.getByMessage,
  getCommunicationByProviderMessageId: mocks.getByProvider,
  getScheduleByTaskUid: vi.fn(),
  recordEmailWebhookEvent: mocks.recordEvent,
  recordInboundCommunication: mocks.recordInbound,
  setScheduleHeartbeat: vi.fn(),
  updateCommunicationStatus: mocks.updateStatus,
  upsertEmailSuppression: mocks.upsertSuppression,
}));
vi.mock("./email", () => ({
  emailProviderConfigured: vi.fn(() => false),
  retrieveInboundEmail: mocks.retrieveInbound,
  verifyResendWebhook: mocks.verifyWebhook,
  verifyUnsubscribeSignature: mocks.verifyUnsubscribe,
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./weeklyReports", () => ({ processWeeklyReportSchedule: vi.fn() }));
vi.mock("./followUps", () => ({ processClientFollowUpSchedule: vi.fn() }));

import { registerOperationsRoutes } from "./operationsRoutes";

async function request(path: string, init: RequestInit) {
  const app = express();
  registerOperationsRoutes(app);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, init);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function webhookRequest() {
  return {
    method: "POST",
    headers: { "content-type": "application/json", "svix-id": "evt_123", "svix-timestamp": "1", "svix-signature": "sig" },
    body: JSON.stringify({ any: "payload" }),
  };
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.getByProvider.mockResolvedValue({ id: 17, userId: 9, recipientEmail: "client@example.com" });
  mocks.recordEvent.mockResolvedValue({ event: { id: 3 }, created: true });
  mocks.verifyUnsubscribe.mockReturnValue(true);
});

afterEach(() => vi.clearAllMocks());

describe("native Resend webhook routes", () => {
  it("records a lifecycle event once and ignores a replayed svix-id", async () => {
    mocks.verifyWebhook.mockReturnValue({ type: "email.delivered", data: { email_id: "mail_1" } });
    mocks.recordEvent.mockResolvedValueOnce({ event: { id: 3 }, created: true }).mockResolvedValueOnce({ event: { id: 3 }, created: false });

    const first = await request("/api/webhooks/resend", webhookRequest());
    const second = await request("/api/webhooks/resend", webhookRequest());

    expect(first.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    expect(mocks.updateStatus).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeEvent).toHaveBeenCalledWith(3, { status: "processed" });
  });

  it("creates suppression state for a provider complaint before future sends can be attempted", async () => {
    mocks.verifyWebhook.mockReturnValue({ type: "email.complained", data: { email_id: "mail_1" } });

    const response = await request("/api/webhooks/resend", webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledWith(9, 17, expect.objectContaining({ status: "complained" }));
    expect(mocks.upsertSuppression).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, email: "client@example.com", reason: "complaint" }));
  });

  it("accepts a valid signed unsubscribe request and rejects an invalid signature", async () => {
    const valid = await request("/api/unsubscribe?u=9&e=client%40example.com&s=ok", { method: "POST" });
    expect(valid.status).toBe(200);
    expect(mocks.upsertSuppression).toHaveBeenCalledWith({ userId: 9, email: "client@example.com", reason: "unsubscribe" });

    mocks.verifyUnsubscribe.mockReturnValue(false);
    const invalid = await request("/api/unsubscribe?u=9&e=client%40example.com&s=tampered", { method: "GET" });
    expect(invalid.status).toBe(400);
  });

  it("reconstructs an inbound reply thread from In-Reply-To before recording the message", async () => {
    mocks.verifyWebhook.mockReturnValue({ type: "email.received", data: { email_id: "inbound_1" } });
    mocks.retrieveInbound.mockResolvedValue({ id: "inbound_1", message_id: "<reply@reply.example>", from: "client@example.com", to: ["inbox@reply.example.com"], subject: "Re: Weekly report", text: "Thanks", html: "<p>Thanks</p>", headers: { "In-Reply-To": "<parent@reply.example>", References: "<root@reply.example> <parent@reply.example>" }, created_at: "2026-08-13T00:00:00.000Z" });
    mocks.findInboundOwner.mockResolvedValue({ userId: 9 });
    mocks.findClientByEmail.mockResolvedValue({ id: 55 });
    mocks.getByMessage.mockResolvedValue({ id: 17, clientId: 55, messageId: "<parent@reply.example>", threadKey: "<root@reply.example>" });
    mocks.recordInbound.mockResolvedValue({ id: 99 });

    const response = await request("/api/webhooks/resend", webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.recordInbound).toHaveBeenCalledWith(expect.objectContaining({ clientId: 55, inReplyTo: "<parent@reply.example>", referencesHeader: "<root@reply.example> <parent@reply.example>", threadKey: "<root@reply.example>" }));
  });
});
