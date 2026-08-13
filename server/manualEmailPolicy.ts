import { assertRecipientCanReceiveEmail, isEmailSuppressed } from "./clientOps";

export async function assertManualEmailCanSend(userId: number, recipientEmail: string) {
  assertRecipientCanReceiveEmail(await isEmailSuppressed(userId, recipientEmail));
}
