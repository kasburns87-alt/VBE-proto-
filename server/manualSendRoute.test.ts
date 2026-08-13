import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  getSettings: vi.fn(),
  queue: vi.fn(),
  gate: vi.fn(),
}));

vi.mock("./clientOps", async importOriginal => {
  const actual = await importOriginal<typeof import("./clientOps")>();
  return { ...actual, getClient: mocks.getClient, getCommunicationSettings: mocks.getSettings, createOutboundCommunication: mocks.queue };
});
vi.mock("./manualEmailPolicy", () => ({ assertManualEmailCanSend: mocks.gate }));

import { appRouter } from "./routers";

function callerWithUser() {
  return appRouter.createCaller({
    user: { id: 8, openId: "route-test-user", name: "Route Test", email: "operator@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

describe("manual client email route suppression", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.getClient.mockResolvedValue({ id: 55, email: "client@example.com" });
    mocks.getSettings.mockResolvedValue({ fromAddress: "reports@reply.example.com" });
    mocks.gate.mockRejectedValue(new Error("This recipient is suppressed for complaint."));
  });

  it("rejects the protected manual send route before queueing an outbound record", async () => {
    const caller = callerWithUser();
    await expect(caller.clientOps.communications.send({ clientId: 55, subject: "Campaign update", bodyText: "A concise update.", idempotencyKey: "manual-route-suppression-test" })).rejects.toThrow("suppressed");
    expect(mocks.gate).toHaveBeenCalledWith(8, "client@example.com");
    expect(mocks.queue).not.toHaveBeenCalled();
  });
});
