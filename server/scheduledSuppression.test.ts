import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  getSettings: vi.fn(),
  getSchedule: vi.fn(),
  isSuppressed: vi.fn(),
  assertRecipient: vi.fn(),
  createCommunication: vi.fn(),
  createDelivery: vi.fn(),
  reserveUsage: vi.fn(),
  send: vi.fn(),
}));

vi.mock("./clientOps", () => ({
  assertRecipientCanReceiveEmail: mocks.assertRecipient,
  createOutboundCommunication: mocks.createCommunication,
  createReportDelivery: mocks.createDelivery,
  findClientByEmail: vi.fn(),
  getClient: mocks.getClient,
  getClientSchedule: mocks.getSchedule,
  getCommunicationSettings: mocks.getSettings,
  getScheduleByTaskUid: vi.fn(),
  isEmailSuppressed: mocks.isSuppressed,
  updateCommunicationStatus: vi.fn(),
  updateReportDelivery: vi.fn(),
}));
vi.mock("./db", () => ({ getAnalyticsSnapshotsForUser: vi.fn(), reserveMonthlyUsage: mocks.reserveUsage }));
vi.mock("./email", () => ({ createUnsubscribeUrl: vi.fn(), plainTextToEmailHtml: vi.fn(), sendTransactionalEmail: mocks.send }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./analytics", () => ({ summarizeAnalytics: vi.fn() }));

import { ENV } from "./_core/env";
import { processClientFollowUpSchedule } from "./followUps";
import { processWeeklyReportSchedule } from "./weeklyReports";

const originalFrom = ENV.resendFromEmail;

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  ENV.resendFromEmail = "reports@reply.example.com";
  mocks.assertRecipient.mockImplementation((suppression: any) => { if (suppression) throw new Error(`This recipient is suppressed for ${suppression.reason}.`); });
  mocks.isSuppressed.mockResolvedValue({ reason: "unsubscribe" });
});
afterEach(() => { ENV.resendFromEmail = originalFrom; });

describe("scheduled suppression guards", () => {
  it("blocks a follow-up before queueing a communication or consuming email quota", async () => {
    mocks.getClient.mockResolvedValue({ id: 7, name: "Client", email: "client@example.com" });
    mocks.getSettings.mockResolvedValue(null);

    await expect(processClientFollowUpSchedule({ id: 11, userId: 2, clientId: 7, recipientEmail: "client@example.com", label: "Check in", scheduleType: "follow_up" })).rejects.toThrow("suppressed");
    expect(mocks.createCommunication).not.toHaveBeenCalled();
    expect(mocks.reserveUsage).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("blocks a weekly report before creating a delivery record, PDF, or provider send", async () => {
    await expect(processWeeklyReportSchedule({ id: 12, userId: 2, clientId: null, recipientEmail: "client@example.com", label: "Weekly report" }, { deliver: true })).rejects.toThrow("suppressed");
    expect(mocks.createDelivery).not.toHaveBeenCalled();
    expect(mocks.reserveUsage).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
