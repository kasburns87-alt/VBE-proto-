import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { summarizeAnalytics } from "./analytics";
import { getAnalyticsSnapshotsForUser, reserveMonthlyUsage } from "./db";
import {
  createReportDelivery,
  findClientByEmail,
  getClient,
  getClientSchedule,
  getCommunicationSettings,
  getScheduleByTaskUid,
  isEmailSuppressed,
  updateReportDelivery,
} from "./clientOps";
import { createUnsubscribeUrl, sendTransactionalEmail } from "./email";
import { storagePut } from "./storage";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function lastSevenDayPeriod(reference = new Date()) {
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function text(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function drawLine(page: any, value: string, x: number, y: number, font: any, size = 11, color = rgb(0.14, 0.11, 0.18)) {
  page.drawText(value, { x, y, size, font, color });
}

export async function renderWeeklyAnalyticsPdf(input: { title: string; recipientName: string; periodStart: string; periodEnd: string; summary: ReturnType<typeof summarizeAnalytics> }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const plum = rgb(0.12, 0.09, 0.17);
  const blush = rgb(0.91, 0.65, 0.75);
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.98, 0.97, 0.99) });
  page.drawRectangle({ x: 0, y: 710, width: 612, height: 82, color: plum });
  drawLine(page, "PULSEFORGE / WEEKLY SIGNAL REPORT", 44, 753, bold, 9, blush);
  drawLine(page, input.title, 44, 728, bold, 20, rgb(1, 1, 1));
  drawLine(page, `${input.periodStart} — ${input.periodEnd}  •  Prepared for ${input.recipientName}`, 44, 684, regular, 10, rgb(0.35, 0.31, 0.4));
  if (input.summary.snapshotCount === 0) {
    drawLine(page, "No verified reporting snapshots were available for this period.", 44, 632, bold, 14, plum);
    drawLine(page, "Import Meta, TikTok, or YouTube reporting exports to create the next complete weekly summary.", 44, 610, regular, 10, rgb(0.35, 0.31, 0.4));
  } else {
    const metrics = [
      ["Impressions", text(input.summary.totals.impressions)],
      ["Engagement rate", `${input.summary.totals.engagementRate}%`],
      ["Clicks", text(input.summary.totals.clicks)],
      ["Conversions", text(input.summary.totals.conversions)],
      ["Spend", money(input.summary.totals.spend)],
      ["Cost / conversion", input.summary.totals.conversions ? money(input.summary.totals.costPerConversion) : "—"],
    ];
    metrics.forEach(([label, value], index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = 44 + column * 174;
      const y = 626 - row * 78;
      page.drawRectangle({ x, y: y - 18, width: 154, height: 58, color: rgb(1, 1, 1), borderColor: rgb(0.9, 0.86, 0.92), borderWidth: 1 });
      drawLine(page, label, x + 12, y + 20, bold, 8, rgb(0.46, 0.39, 0.49));
      drawLine(page, value, x + 12, y + 2, bold, 16, plum);
    });
    drawLine(page, "Platform contribution", 44, 426, bold, 13, plum);
    input.summary.platforms.forEach((platform, index) => {
      const y = 394 - index * 48;
      drawLine(page, platform.platform.toUpperCase(), 44, y, bold, 9, rgb(0.43, 0.35, 0.46));
      drawLine(page, `${text(platform.impressions)} impressions  •  ${platform.clickThroughRate}% CTR  •  ${text(platform.conversions)} conversions`, 132, y, regular, 10, plum);
    });
    drawLine(page, "Leading campaigns", 44, 226, bold, 13, plum);
    input.summary.campaigns.slice(0, 4).forEach((campaign, index) => {
      const y = 196 - index * 28;
      drawLine(page, `${index + 1}. ${campaign.campaignName}`, 44, y, bold, 10, plum);
      drawLine(page, `${text(campaign.impressions)} impressions · ${campaign.clickThroughRate}% CTR · ${text(campaign.conversions)} conversions`, 265, y, regular, 9, rgb(0.38, 0.33, 0.42));
    });
  }
  drawLine(page, "PulseForge AI • Verified dashboard data only", 44, 38, regular, 8, rgb(0.43, 0.37, 0.47));
  return Buffer.from(await pdf.save());
}

export async function generateAndSendWeeklyReport(input: { userId: number; scheduleId: number; referenceDate?: Date }) {
  const schedule = await getClientSchedule(input.userId, input.scheduleId);
  if (schedule.scheduleType !== "weekly_report") throw new Error("Only weekly report schedules can generate an analytics PDF.");
  return processWeeklyReportSchedule(schedule, { deliver: true, referenceDate: input.referenceDate });
}

export async function processWeeklyReportSchedule(schedule: { id: number; userId: number; clientId: number | null; recipientEmail: string | null; label: string }, options: { deliver?: boolean; referenceDate?: Date } = {}) {
  if (!schedule.recipientEmail) throw new Error("This weekly report schedule has no recipient email.");
  const { startDate, endDate } = lastSevenDayPeriod(options.referenceDate);
  const idempotencyKey = `weekly-report:${schedule.id}:${endDate}`;
  const delivery = await createReportDelivery({
    userId: schedule.userId,
    clientId: schedule.clientId,
    scheduleId: schedule.id,
    periodStart: startDate,
    periodEnd: endDate,
    recipientEmail: schedule.recipientEmail,
    idempotencyKey,
  });
  if (delivery.status === "sent") return delivery;
  try {
    await reserveMonthlyUsage(schedule.userId, "reportGenerations");
    let client: Awaited<ReturnType<typeof getClient>> | null = null;
    if (schedule.clientId) {
      client = await getClient(schedule.userId, schedule.clientId);
    } else {
      const matchedClient = await findClientByEmail(schedule.userId, schedule.recipientEmail);
      if (matchedClient) client = await getClient(schedule.userId, matchedClient.id);
    }
    const campaignIds = client?.campaigns.map(campaign => campaign.id) || [];
    const rows = await getAnalyticsSnapshotsForUser(schedule.userId, { campaignIds, startDate, endDate });
    const summary = summarizeAnalytics(rows);
    const pdf = await renderWeeklyAnalyticsPdf({ title: schedule.label, recipientName: client?.name || schedule.recipientEmail, periodStart: startDate, periodEnd: endDate, summary });
    const uploaded = await storagePut(`reports/${schedule.userId}/${schedule.id}/${endDate}.pdf`, pdf, "application/pdf");
    await updateReportDelivery(schedule.userId, delivery.id, { status: "generated", fileKey: uploaded.key, fileUrl: uploaded.url });
    if (!options.deliver) return { ...delivery, status: "generated", fileKey: uploaded.key, fileUrl: uploaded.url };
    const suppression = await isEmailSuppressed(schedule.userId, schedule.recipientEmail);
    if (suppression) throw new Error(`This recipient is suppressed for ${suppression.reason} and cannot receive weekly reports.`);
    const settings = await getCommunicationSettings(schedule.userId);
    const messageId = await sendTransactionalEmail({
      to: schedule.recipientEmail,
      subject: `Weekly performance report · ${startDate} to ${endDate}`,
      text: `Your PulseForge weekly report for ${startDate} to ${endDate} is attached. It contains verified analytics snapshots only.`,
      html: `<p>Your PulseForge weekly report for <strong>${startDate} to ${endDate}</strong> is attached.</p><p>This summary contains verified analytics snapshots only.</p>`,
      replyTo: settings?.replyToAddress || undefined,
      idempotencyKey,
      unsubscribeUrl: createUnsubscribeUrl(schedule.userId, schedule.recipientEmail),
      attachment: { filename: `pulseforge-weekly-report-${endDate}.pdf`, content: pdf.toString("base64") },
    });
    await updateReportDelivery(schedule.userId, delivery.id, { status: "sent", fileKey: uploaded.key, fileUrl: uploaded.url, providerMessageId: messageId });
    return { ...delivery, status: "sent", fileKey: uploaded.key, fileUrl: uploaded.url, providerMessageId: messageId };
  } catch (error) {
    await updateReportDelivery(schedule.userId, delivery.id, { status: "failed", errorMessage: error instanceof Error ? error.message : "Report delivery failed." });
    throw error;
  }
}
