import express, { type Express } from "express";
import { sdk } from "./_core/sdk";
import { findClientByEmail, findInboundOwner, getScheduleByTaskUid, recordInboundCommunication, setScheduleHeartbeat } from "./clientOps";
import { emailProviderConfigured, retrieveInboundEmail, verifyResendWebhook } from "./email";
import { processWeeklyReportSchedule } from "./weeklyReports";
import { processClientFollowUpSchedule } from "./followUps";

export function registerOperationsRoutes(app: Express) {
  app.post("/api/webhooks/resend", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      if (!payload) return res.status(400).json({ error: "raw-payload-required" });
      const event = verifyResendWebhook(payload, {
        id: typeof req.headers["svix-id"] === "string" ? req.headers["svix-id"] : undefined,
        timestamp: typeof req.headers["svix-timestamp"] === "string" ? req.headers["svix-timestamp"] : undefined,
        signature: typeof req.headers["svix-signature"] === "string" ? req.headers["svix-signature"] : undefined,
      });
      if (event.type !== "email.received") return res.json({ ok: true, ignored: event.type || "unknown" });
      const data = event.data || {};
      const emailId = typeof data.email_id === "string" ? data.email_id : "";
      const eventId = typeof req.headers["svix-id"] === "string" ? req.headers["svix-id"] : "";
      if (!emailId || !eventId) return res.status(400).json({ error: "missing-email-event-identifiers" });
      const inbound = await retrieveInboundEmail(emailId);
      let settings = null;
      let recipient = "";
      for (const address of inbound.to || []) {
        const found = await findInboundOwner(address.toLowerCase());
        if (found) { settings = found; recipient = address.toLowerCase(); break; }
      }
      if (!settings) return res.json({ ok: true, skipped: "unrouted-inbound-address" });
      const client = await findClientByEmail(settings.userId, inbound.from.toLowerCase());
      await recordInboundCommunication({
        userId: settings.userId,
        clientId: client?.id || null,
        senderEmail: inbound.from,
        recipientEmail: recipient,
        subject: inbound.subject || "(No subject)",
        bodyText: inbound.text || undefined,
        bodyHtml: inbound.html || undefined,
        providerMessageId: inbound.message_id || inbound.id,
        providerEventId: eventId,
        receivedAt: new Date(inbound.created_at),
      });
      return res.json({ ok: true });
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
