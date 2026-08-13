import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isSuppressed: vi.fn(), assertRecipient: vi.fn() }));
vi.mock("./clientOps", () => ({ isEmailSuppressed: mocks.isSuppressed, assertRecipientCanReceiveEmail: mocks.assertRecipient }));

import { assertManualEmailCanSend } from "./manualEmailPolicy";

describe("manual client email suppression", () => {
  beforeEach(() => {
    mocks.isSuppressed.mockReset();
    mocks.assertRecipient.mockReset();
    mocks.assertRecipient.mockImplementation((suppression: any) => { if (suppression) throw new Error(`This recipient is suppressed for ${suppression.reason}.`); });
  });

  it("blocks a manually composed client email before queueing or provider delivery", async () => {
    mocks.isSuppressed.mockResolvedValue({ reason: "complaint" });
    await expect(assertManualEmailCanSend(3, "client@example.com")).rejects.toThrow("suppressed");
    expect(mocks.isSuppressed).toHaveBeenCalledWith(3, "client@example.com");
  });
});
