import { createHash } from "node:crypto";
import { createOutboundCommunication, getClient, getCommunicationSettings, isEmailSuppressed, updateCommunicationStatus } from "./clientOps";
import { reserveMonthlyUsage } from "./db";
import { createUnsubscribeUrl, plainTextToEmailHtml, sendTransactionalEmail } from "./email";
import { ENV } from "./_core/env";

export async function processClientFollowUpSchedule(schedule: { id: number; userId: number; clientId: number | null; recipientEmail: string | null; label: string; scheduleType: "follow_up" | "reminder" | "weekly_report" }) {
  if (schedule.scheduleType === "weekly_report") throw new Error("Weekly reports must be processed by the report workflow.");
  if (!schedule.clientId) throw new Error("Client follow-up schedules require a linked client.");
  const [client, settings] = await Promise.all([getClient(schedule.userId, schedule.clientId), getCommunicationSettings(schedule.userId)]);
  const senderEmail = ENV.resendFromEmail || settings?.fromAddress;
  if (!senderEmail) throw new Error("Set up a verified transactional sender before delivering follow-up email.");
  const recipientEmail = schedule.recipientEmail || client.email;
  const suppression = await isEmailSuppressed(schedule.userId, recipientEmail);
  if (suppression) throw new Error(`This recipient is suppressed for ${suppression.reason} and cannot receive scheduled email.`);
  const subject = schedule.scheduleType === "reminder" ? `Reminder · ${schedule.label}` : `Follow-up · ${schedule.label}`;
  const bodyText = `Hello ${client.name},\n\nThis is a scheduled PulseForge ${schedule.scheduleType === "reminder" ? "reminder" : "follow-up"}: ${schedule.label}.\n\nBest,\n${settings?.senderName || "PulseForge"}`;
  const idempotencyKey = `scheduled-follow-up:${schedule.id}:${new Date().toISOString().slice(0, 10)}`;
  const senderDomain = senderEmail.split("@")[1];
  if (!senderDomain) throw new Error("The sender address must include a verified domain.");
  const messageId = `<pulseforge-${createHash("sha256").update(`${schedule.userId}:${idempotencyKey}`).digest("hex").slice(0, 32)}@${senderDomain}>`;
  await reserveMonthlyUsage(schedule.userId, "outboundEmails");
  const queued = await createOutboundCommunication(schedule.userId, { clientId: client.id, senderEmail, recipientEmail, subject, bodyText, bodyHtml: plainTextToEmailHtml(bodyText), threadKey: messageId, idempotencyKey });
  try {
    const providerMessageId = await sendTransactionalEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: plainTextToEmailHtml(bodyText),
      replyTo: settings?.replyToAddress || undefined,
      idempotencyKey,
      messageId,
      unsubscribeUrl: createUnsubscribeUrl(schedule.userId, recipientEmail),
    });
    await updateCommunicationStatus(schedule.userId, queued.id, { status: "sent", providerMessageId, messageId });
    return { ...queued, status: "sent", providerMessageId };
  } catch (error) {
    await updateCommunicationStatus(schedule.userId, queued.id, { status: "failed", errorMessage: error instanceof Error ? error.message : "Follow-up delivery failed." });
    throw error;
  }
}
