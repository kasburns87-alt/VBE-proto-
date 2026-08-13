import express, { type Express } from "express";
import { sdk } from "./_core/sdk";
import { finalizeEmailWebhookEvent, findClientByEmail, findInboundOwner, getCommunicationByMessageId, getCommunicationByProviderMessageId, getScheduleByTaskUid, recordEmailWebhookEvent, recordInboundCommunication, setScheduleHeartbeat, updateCommunicationStatus, upsertEmailSuppression } from "./clientOps";
import { emailProviderConfigured, retrieveInboundEmail, verifyResendWebhook, verifyUnsubscribeSignature } from "./email";
import { processWeeklyReportSchedule } from "./weeklyReports";
import { processClientFollowUpSchedule } from "./followUps";
import { getHeaderValue, mapResendLifecycleEvent, replyCandidates, shouldProcessWebhookEvent, suppressionReasonForLifecycle } from "./resendLifecycle";

export function registerOperationsRoutes(app: Express) {
  app.all("/api/unsubscribe", async (req, res) => {
    const userId = Number(req.query.u);
    const email = typeof req.query.e === "string" ? req.query.e : "";
    const signature = typeof req.query.s === "string" ? req.query.s : "";
    if (!Number.isInteger(userId) || userId <= 0 || !email || !signature || !verifyUnsubscribeSignature(userId, email, signature)) {
      return res.status(400).type("text/plain").send("This unsubscribe link is invalid or has expired.");
    }
    await upsertEmailSuppression({ userId, email, reason: "unsubscribe" });
    return res.status(200).type("text/html").send("<!doctype html><html><body style=\"font-family:Arial,sans-serif;padding:48px;color:#201c28\"><h1>You are unsubscribed.</h1><p>You will no longer receive PulseForge client communications at this address.</p></body></html>");
  });

  app.post("/api/webhooks/resend", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      if (!payload) return res.status(400).json({ error: "raw-payload-required" });
      const event = verifyResendWebhook(payload, {
        id: typeof req.headers["svix-id"] === "string" ? req.headers["svix-id"] : undefined,
        timestamp: typeof req.headers["svix-timestamp"] === "string" ? req.headers["svix-timestamp"] : undefined,
        signature: typeof req.headers["svix-signature"] === "string" ? req.headers["svix-signature"] : undefined,
      });
      const eventId = typeof req.headers["svix-id"] === "string" ? req.headers["svix-id"] : "";
      if (!eventId) return res.status(400).json({ error: "missing-webhook-event-id" });
      const data = (event.data || {}) as Record<string, unknown>;
      const eventType = event.type || "unknown";
      const providerMessageId = typeof data.email_id === "string" ? data.email_id : typeof data.id === "string" ? data.id : undefined;

      if (eventType === "email.received") {
        if (!providerMessageId) return res.status(400).json({ error: "missing-received-email-id" });
        const inbound = await retrieveInboundEmail(providerMessageId);
        let settings = null;
        let recipient = "";
        for (const address of inbound.to || []) {
          const found = await findInboundOwner(address.toLowerCase());
          if (found) { settings = found; recipient = address.toLowerCase(); break; }
        }
        if (!settings) {
          const eventRecord = await recordEmailWebhookEvent({ providerEventId: eventId, providerMessageId, eventType, payloadJson: payload });
        if (shouldProcessWebhookEvent(eventRecord.created)) await finalizeEmailWebhookEvent(eventRecord.event.id, { status: "ignored", errorMessage: "No configured inbound mailbox matched this recipient." });
          return res.json({ ok: true, skipped: "unrouted-inbound-address" });
        }
        const messageId = inbound.message_id || getHeaderValue(inbound.headers, "message-id") || undefined;
        const inReplyTo = getHeaderValue(inbound.headers, "in-reply-to") || undefined;
        const referencesHeader = getHeaderValue(inbound.headers, "references") || undefined;
        const candidates = replyCandidates(inReplyTo, referencesHeader);
        let parent = null;
        for (const candidate of candidates) {
          parent = await getCommunicationByMessageId(settings.userId, candidate);
          if (parent) break;
        }
        const client = await findClientByEmail(settings.userId, inbound.from.toLowerCase());
        const communication = await recordInboundCommunication({
          userId: settings.userId,
          clientId: client?.id || parent?.clientId || null,
          senderEmail: inbound.from,
          recipientEmail: recipient,
          subject: inbound.subject || "(No subject)",
          bodyText: inbound.text || undefined,
          bodyHtml: inbound.html || undefined,
          providerMessageId: inbound.id,
          providerEventId: eventId,
          messageId,
          inReplyTo,
          referencesHeader,
          threadKey: parent?.threadKey || parent?.messageId || inReplyTo || messageId || eventId,
          receivedAt: new Date(inbound.created_at),
        });
        const eventRecord = await recordEmailWebhookEvent({ providerEventId: eventId, providerMessageId, eventType, userId: settings.userId, communicationId: communication.id, payloadJson: payload });
        if (shouldProcessWebhookEvent(eventRecord.created)) await finalizeEmailWebhookEvent(eventRecord.event.id, { status: "processed" });
        return res.json({ ok: true, communicationId: communication.id });
      }

      const communication = providerMessageId ? await getCommunicationByProviderMessageId(providerMessageId) : null;
      const eventRecord = await recordEmailWebhookEvent({ providerEventId: eventId, providerMessageId, eventType, userId: communication?.userId, communicationId: communication?.id, payloadJson: payload });
      if (!shouldProcessWebhookEvent(eventRecord.created)) return res.json({ ok: true, duplicate: true });
      if (eventType === "suppression.added" && communication) {
        await upsertEmailSuppression({ userId: communication.userId, email: communication.recipientEmail, reason: "manual", sourceEventId: eventId });
        await updateCommunicationStatus(communication.userId, communication.id, { status: "suppressed", providerEventId: eventId, providerMessageId });
        await finalizeEmailWebhookEvent(eventRecord.event.id, { status: "processed" });
        return res.json({ ok: true, communicationId: communication.id, status: "suppressed" });
      }
      const lifecycle = mapResendLifecycleEvent(eventType);
      if (!communication || !lifecycle) {
        await finalizeEmailWebhookEvent(eventRecord.event.id, { status: "ignored", errorMessage: communication ? "Unsupported lifecycle event." : "No owned communication matched the provider message." });
        return res.json({ ok: true, ignored: eventType });
      }
      await updateCommunicationStatus(communication.userId, communication.id, { status: lifecycle, providerEventId: eventId, providerMessageId });
      const suppressionReason = suppressionReasonForLifecycle(lifecycle);
      if (suppressionReason) {
        await upsertEmailSuppression({ userId: communication.userId, email: communication.recipientEmail, reason: suppressionReason, sourceEventId: eventId });
      }
      await finalizeEmailWebhookEvent(eventRecord.event.id, { status: "processed" });
      return res.json({ ok: true, communicationId: communication.id, status: lifecycle });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : "inbound-email-processing-failed" });
    }
  });

  app.post("/api/scheduled/weekly-report", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req as never);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const schedule = await getScheduleByTaskUid(user.taskUid);
      if (!schedule) return res.json({ ok: true, skipped: "orphan-schedule" });
      if (!schedule.isEnabled) return res.json({ ok: true, skipped: "paused" });
      if (!emailProviderConfigured()) return res.status(409).json({ error: "email-delivery-not-configured", scheduleId: schedule.id });
      const delivery = await processWeeklyReportSchedule(schedule);
      await setScheduleHeartbeat(schedule.userId, schedule.id, { lastRunAt: new Date() });
      return res.json({ ok: true, scheduleId: schedule.id, deliveryId: delivery.id, status: delivery.status });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "weekly-report-failed",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.post("/api/scheduled/client-follow-up", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req as never);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const schedule = await getScheduleByTaskUid(user.taskUid);
      if (!schedule) return res.json({ ok: true, skipped: "orphan-schedule" });
      if (!schedule.isEnabled) return res.json({ ok: true, skipped: "paused" });
      if (!emailProviderConfigured()) return res.status(409).json({ error: "email-delivery-not-configured", scheduleId: schedule.id });
      if (schedule.scheduleType === "weekly_report") return res.status(400).json({ error: "wrong-schedule-type" });
      const communication = await processClientFollowUpSchedule(schedule);
      await setScheduleHeartbeat(schedule.userId, schedule.id, { lastRunAt: new Date() });
      return res.json({ ok: true, scheduleId: schedule.id, communicationId: communication.id, status: communication.status });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "client-follow-up-failed", timestamp: new Date().toISOString() });
    }
  });
}
