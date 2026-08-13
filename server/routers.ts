import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { generateCampaignBlueprint, generateCampaignImages, slugify } from "./campaign";
import {
  createCampaign,
  createSavedAnalyticsView,
  deleteSavedAnalyticsView,
  getAnalyticsSnapshotsForUser,
  getCampaignsForUser,
  getCampaignWithAssets,
  listSavedAnalyticsViews,
  saveCampaignAssets,
  saveCampaignExport,
  recordAnalyticsSnapshot,
  recordAnalyticsSnapshots,
  renameSavedAnalyticsView,
  reserveMonthlyUsage,
  setDefaultSavedAnalyticsView,
  updateCampaignOutput,
} from "./db";
import { summarizeAnalytics } from "./analytics";
import { storagePut } from "./storage";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import {
  createClient,
  createClientSchedule,
  createOutboundCommunication,
  getClient,
  getClientSchedule,
  getCommunicationSettings,
  assertRecipientCanReceiveEmail,
  isEmailSuppressed,
  listEmailSuppressions,
  listClientSchedules,
  listClients,
  listCommunications,
  listReportDeliveries,
  saveCommunicationSettings,
  removeEmailSuppression,
  setScheduleHeartbeat,
  updateClient,
  updateCommunicationStatus,
  upsertEmailSuppression,
} from "./clientOps";
import { createUnsubscribeUrl, emailProviderConfigured, emailProviderReadiness, plainTextToEmailHtml, sendTransactionalEmail } from "./email";
import { createNativeMessageIdentifiers } from "./resendLifecycle";
import { processWeeklyReportSchedule } from "./weeklyReports";
import { processClientFollowUpSchedule } from "./followUps";

const platforms = ["meta", "tiktok", "youtube"] as const;
const analyticsFilterSchema = z.object({
  campaignIds: z.array(z.number().int().positive()).max(2).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
}).refine(value => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "The start date must not be after the end date.",
  path: ["endDate"],
});
const savedAnalyticsViewSchema = analyticsFilterSchema.safeExtend({
  name: z.string().trim().min(2).max(120),
  datePreset: z.enum(["all", "last7", "last30", "custom"]),
});
const analyticsSnapshotSchema = z.object({
  campaignId: z.number().int().positive(),
  platform: z.enum(platforms),
  metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  impressions: z.number().int().min(0).max(2_000_000_000),
  engagements: z.number().int().min(0).max(2_000_000_000),
  clicks: z.number().int().min(0).max(2_000_000_000),
  conversions: z.number().int().min(0).max(2_000_000_000),
  videoViews: z.number().int().min(0).max(2_000_000_000),
  saves: z.number().int().min(0).max(2_000_000_000),
  spendCents: z.number().int().min(0).max(2_000_000_000),
});
const briefSchema = z.object({
  productName: z.string().trim().min(2).max(180),
  industry: z.string().trim().min(2).max(140),
  targetAudience: z.string().trim().min(10).max(1000),
  goal: z.string().trim().min(2).max(160),
  tone: z.string().trim().min(2).max(120),
  platforms: z.array(z.enum(platforms)).min(1),
});
const clientInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  company: z.string().trim().max(180).optional(),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional(),
  title: z.string().trim().max(140).optional(),
  industry: z.string().trim().max(140).optional(),
  status: z.enum(["lead", "active", "paused", "archived"]),
  notes: z.string().trim().max(10_000).optional(),
  rapportDetails: z.string().trim().max(5_000).optional(),
  campaignIds: z.array(z.number().int().positive()).max(100),
});
const scheduleSchema = z.object({
  clientId: z.number().int().positive().optional(),
  scheduleType: z.enum(["follow_up", "weekly_report", "reminder"]),
  label: z.string().trim().min(2).max(180),
  recipientEmail: z.string().trim().email().max(320).optional(),
  timezone: z.string().trim().min(3).max(80),
  cronExpression: z.string().trim().regex(/^\S+(\s+\S+){5}$/, "Use a 6-field UTC cron expression.").optional(),
});

function decodeBase64(value: string) {
  const normalized = value.replace(/^data:[^;]+;base64,/, "");
  if (!normalized || /[^A-Za-z0-9+/=]/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error("The uploaded file is not valid base64 data.");
  }
  return Buffer.from(normalized, "base64");
}

function base64Schema(maxBytes: number) {
  return z.string().min(20).max(Math.ceil(maxBytes / 3) * 4, "The uploaded file is too large.");
}

const mediaMimeTypes = {
  video: ["video/webm", "video/mp4"],
  audio: ["audio/webm", "audio/mpeg", "audio/wav", "audio/mp4"],
} as const;

function assertMediaMimeType(assetType: "video" | "audio", mimeType: string) {
  if (!(mediaMimeTypes[assetType] as readonly string[]).includes(mimeType)) throw new Error(`Unsupported ${assetType} format.`);
}

function decodeCampaignIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 2) : [];
  } catch {
    return [];
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  campaign: router({
    generate: protectedProcedure.input(briefSchema).mutation(async ({ ctx, input }) => {
      await reserveMonthlyUsage(ctx.user.id, "campaignGenerations");
      const campaign = await createCampaign({ ...input, userId: ctx.user.id });
      try {
        const blueprint = await generateCampaignBlueprint(input);
        const assets = await generateCampaignImages(input, blueprint, { userId: ctx.user.id, campaignId: campaign.id });
        await updateCampaignOutput(ctx.user.id, campaign.id, {
          campaignName: blueprint.campaignName,
          insightsJson: JSON.stringify(blueprint),
          status: "complete",
        });
        await saveCampaignAssets(ctx.user.id, campaign.id, assets);
        const completed = await getCampaignWithAssets(ctx.user.id, campaign.id);
        if (!completed) throw new Error("Campaign could not be retrieved after generation.");
        return completed;
      } catch (error) {
        await updateCampaignOutput(ctx.user.id, campaign.id, {
          campaignName: input.productName,
          insightsJson: JSON.stringify({ error: "Generation did not complete." }),
          status: "failed",
        });
        throw error;
      }
    }),
    list: protectedProcedure.query(({ ctx }) => getCampaignsForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) =>
      getCampaignWithAssets(ctx.user.id, input.id)
    ),
    saveGeneratedMedia: protectedProcedure.input(z.object({
      campaignId: z.number().int().positive(),
      platform: z.enum(platforms),
      assetType: z.enum(["video", "audio"]),
      format: z.string().min(2).max(120),
      label: z.string().min(2).max(220),
      fileName: z.string().min(2).max(160),
      mimeType: z.string().min(3).max(120),
      dataBase64: base64Schema(15 * 1024 * 1024),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      durationSeconds: z.number().int().positive().max(90).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getCampaignWithAssets(ctx.user.id, input.campaignId);
      if (!existing) throw new Error("Campaign not found.");
      assertMediaMimeType(input.assetType, input.mimeType);
      const bytes = decodeBase64(input.dataBase64);
      if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("Media is too large to save. Keep campaign motion cuts under 15 MB.");
      const uploaded = await storagePut(
        `campaigns/${ctx.user.id}/${input.campaignId}/media/${slugify(input.fileName)}`,
        bytes,
        input.mimeType
      );
      await saveCampaignAssets(ctx.user.id, input.campaignId, [{
        platform: input.platform,
        assetType: input.assetType,
        format: input.format,
        label: input.label,
        fileKey: uploaded.key,
        fileUrl: uploaded.url,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        durationSeconds: input.durationSeconds,
        metadataJson: JSON.stringify({ source: "PulseForge motion renderer", includesAudio: input.assetType === "video" }),
      }]);
      const refreshed = await getCampaignWithAssets(ctx.user.id, input.campaignId);
      return refreshed?.assets.find(asset => asset.fileKey === uploaded.key) ?? null;
    }),
    saveExport: protectedProcedure.input(z.object({
      campaignId: z.number().int().positive(),
      fileName: z.string().min(4).max(180),
      dataBase64: base64Schema(30 * 1024 * 1024),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getCampaignWithAssets(ctx.user.id, input.campaignId);
      if (!existing) throw new Error("Campaign not found.");
      const bytes = decodeBase64(input.dataBase64);
      if (bytes.byteLength > 30 * 1024 * 1024) throw new Error("Export is too large to save. Please remove large media and try again.");
      const uploaded = await storagePut(
        `campaigns/${ctx.user.id}/${input.campaignId}/exports/${slugify(input.fileName)}`,
        bytes,
        "application/zip"
      );
      await saveCampaignExport(ctx.user.id, input.campaignId, uploaded);
      return uploaded;
    }),
  }),
  analytics: router({
    overview: protectedProcedure.input(analyticsFilterSchema).query(async ({ ctx, input }) => summarizeAnalytics(await getAnalyticsSnapshotsForUser(ctx.user.id, input))),
    views: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const views = await listSavedAnalyticsViews(ctx.user.id);
        return views.map(view => ({ ...view, campaignIds: decodeCampaignIds(view.campaignIdsJson) }));
      }),
      create: protectedProcedure.input(savedAnalyticsViewSchema).mutation(async ({ ctx, input }) => {
        const view = await createSavedAnalyticsView(ctx.user.id, { ...input, campaignIds: input.campaignIds ?? [] });
        return { ...view, campaignIds: decodeCampaignIds(view.campaignIdsJson) };
      }),
      rename: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
        const view = await renameSavedAnalyticsView(ctx.user.id, input.id, input.name);
        return { ...view, campaignIds: decodeCampaignIds(view.campaignIdsJson) };
      }),
      setDefault: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) =>
        setDefaultSavedAnalyticsView(ctx.user.id, input.id)
      ),
      delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) =>
        deleteSavedAnalyticsView(ctx.user.id, input.id)
      ),
    }),
    record: protectedProcedure.input(analyticsSnapshotSchema).mutation(({ ctx, input }) => recordAnalyticsSnapshot(ctx.user.id, input)),
    importSnapshots: protectedProcedure.input(z.object({ snapshots: z.array(analyticsSnapshotSchema).min(1).max(1000) })).mutation(({ ctx, input }) =>
      recordAnalyticsSnapshots(ctx.user.id, input.snapshots)
    ),
  }),
  clientOps: router({
    clients: router({
      list: protectedProcedure.query(({ ctx }) => listClients(ctx.user.id)),
      get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => getClient(ctx.user.id, input.id)),
      create: protectedProcedure.input(clientInputSchema).mutation(({ ctx, input }) => createClient(ctx.user.id, input)),
      update: protectedProcedure.input(clientInputSchema.extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
        const { id, ...client } = input;
        return updateClient(ctx.user.id, id, client);
      }),
      askAssistant: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), question: z.string().trim().min(2).max(1600) })).mutation(async ({ ctx, input }) => {
        await reserveMonthlyUsage(ctx.user.id, "assistantRequests");
        const client = await getClient(ctx.user.id, input.clientId);
        const communications = await listCommunications(ctx.user.id, input.clientId);
        const context = {
          client: {
            name: client.name,
            company: client.company,
            industry: client.industry,
            status: client.status,
            notes: client.notes,
            rapportDetails: client.rapportDetails,
            campaigns: client.campaigns,
          },
          recentMessages: communications.slice(0, 10).map(message => ({ direction: message.direction, subject: message.subject, body: message.bodyText, createdAt: message.createdAt })),
        };
        const response = await invokeLLM({
          max_tokens: 700,
          messages: [
            { role: "system", content: "You are PulseForge's client operations assistant. Use only the supplied client workspace context. Do not claim an email was sent, a task was performed, or analytics changed. If information is missing, state that plainly and propose the next safe action." },
            { role: "user", content: `Client context:\n${JSON.stringify(context)}\n\nQuestion: ${input.question}` },
          ],
        });
        const answer = response.choices[0]?.message.content;
        if (typeof answer !== "string") throw new Error("The client assistant returned an invalid response.");
        return { answer };
      }),
    }),
    communications: router({
      deliveryStatus: protectedProcedure.query(() => ({
        configured: emailProviderConfigured(),
        provider: "Resend",
        ...emailProviderReadiness(),
      })),
      settings: protectedProcedure.query(({ ctx }) => getCommunicationSettings(ctx.user.id)),
      saveSettings: protectedProcedure.input(z.object({
        fromAddress: z.string().trim().email().max(320).optional(),
        replyToAddress: z.string().trim().email().max(320).optional(),
        inboundAddress: z.string().trim().email().max(320).optional(),
        senderName: z.string().trim().max(160).optional(),
      })).mutation(({ ctx, input }) => saveCommunicationSettings(ctx.user.id, input)),
      list: protectedProcedure.input(z.object({ clientId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listCommunications(ctx.user.id, input?.clientId)),
      listSuppressions: protectedProcedure.query(({ ctx }) => listEmailSuppressions(ctx.user.id)),
      suppress: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), reason: z.enum(["unsubscribe", "bounce", "complaint", "manual"]).default("manual") })).mutation(({ ctx, input }) => upsertEmailSuppression({ userId: ctx.user.id, ...input })),
      unsuppress: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await removeEmailSuppression(ctx.user.id, input.id);
        return { success: true } as const;
      }),
      send: protectedProcedure.input(z.object({ clientId: z.number().int().positive(), subject: z.string().trim().min(2).max(300), bodyText: z.string().trim().min(1).max(20_000), inReplyTo: z.string().trim().max(300).optional(), referencesHeader: z.string().trim().max(4_000).optional(), idempotencyKey: z.string().trim().min(16).max(180) })).mutation(async ({ ctx, input }) => {
        const [client, settings] = await Promise.all([getClient(ctx.user.id, input.clientId), getCommunicationSettings(ctx.user.id)]);
        assertRecipientCanReceiveEmail(await isEmailSuppressed(ctx.user.id, client.email));
        const senderEmail = ENV.resendFromEmail || settings?.fromAddress;
        if (!senderEmail) throw new Error("Set up a verified transactional sender before sending client email.");
        await reserveMonthlyUsage(ctx.user.id, "outboundEmails");
        const senderDomain = senderEmail.split("@")[1];
        if (!senderDomain) throw new Error("The sender address must include a verified domain.");
        const nativeIdentifiers = createNativeMessageIdentifiers({ userId: ctx.user.id, idempotencyKey: input.idempotencyKey, senderDomain, inReplyTo: input.inReplyTo, referencesHeader: input.referencesHeader });
        const queued = await createOutboundCommunication(ctx.user.id, {
          clientId: client.id,
          senderEmail,
          recipientEmail: client.email,
          subject: input.subject,
          bodyText: input.bodyText,
          bodyHtml: plainTextToEmailHtml(input.bodyText),
          inReplyTo: input.inReplyTo,
          referencesHeader: nativeIdentifiers.referencesHeader,
          threadKey: nativeIdentifiers.threadKey,
          idempotencyKey: input.idempotencyKey,
        });
        try {
          const providerMessageId = await sendTransactionalEmail({
            to: client.email,
            subject: input.subject,
            text: input.bodyText,
            html: plainTextToEmailHtml(input.bodyText),
            replyTo: settings?.replyToAddress || undefined,
            idempotencyKey: input.idempotencyKey,
            messageId: nativeIdentifiers.messageId,
            inReplyTo: input.inReplyTo,
            referencesHeader: nativeIdentifiers.referencesHeader,
            unsubscribeUrl: createUnsubscribeUrl(ctx.user.id, client.email),
          });
          await updateCommunicationStatus(ctx.user.id, queued.id, { status: "sent", providerMessageId, messageId: nativeIdentifiers.messageId });
          return { ...queued, status: "sent", providerMessageId };
        } catch (error) {
          await updateCommunicationStatus(ctx.user.id, queued.id, { status: "failed", errorMessage: error instanceof Error ? error.message : "Email send failed." });
          throw error;
        }
      }),
    }),
    schedules: router({
      list: protectedProcedure.query(({ ctx }) => listClientSchedules(ctx.user.id)),
      create: protectedProcedure.input(scheduleSchema).mutation(({ ctx, input }) => createClientSchedule(ctx.user.id, input)),
      activate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const schedule = await getClientSchedule(ctx.user.id, input.id);
        if (!emailProviderConfigured()) throw new Error("Live schedule activation is disabled until Resend credentials, domain verification, and explicit delivery approval are configured.");
        if (!schedule.cronExpression || !schedule.recipientEmail) throw new Error("A report schedule needs a recipient and a 6-field UTC cron expression.");
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const path = schedule.scheduleType === "weekly_report" ? "/api/scheduled/weekly-report" : "/api/scheduled/client-follow-up";
        if (!schedule.scheduleCronTaskUid) {
          const job = await createHeartbeatJob({
            name: `pulseforge-weekly-report-${schedule.id}`,
            cron: schedule.cronExpression,
            path,
            payload: {},
            description: `Weekly PulseForge report: ${schedule.label}`,
          }, sessionToken);
          await setScheduleHeartbeat(ctx.user.id, schedule.id, { taskUid: job.taskUid, isEnabled: 1, nextRunAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null });
          return { taskUid: job.taskUid, nextRunAt: job.nextExecutionAt || null };
        }
        const job = await updateHeartbeatJob(schedule.scheduleCronTaskUid, { cron: schedule.cronExpression, enable: true }, sessionToken);
        await setScheduleHeartbeat(ctx.user.id, schedule.id, { taskUid: schedule.scheduleCronTaskUid, isEnabled: 1, nextRunAt: job.nextExecutionAt ? new Date(job.nextExecutionAt) : null });
        return { taskUid: schedule.scheduleCronTaskUid, nextRunAt: job.nextExecutionAt || null };
      }),
      pause: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const schedule = await getClientSchedule(ctx.user.id, input.id);
        if (!schedule.scheduleCronTaskUid) return { success: true } as const;
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: false }, sessionToken);
        await setScheduleHeartbeat(ctx.user.id, schedule.id, { taskUid: schedule.scheduleCronTaskUid, isEnabled: 0 });
        return { success: true } as const;
      }),
      runNow: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const schedule = await getClientSchedule(ctx.user.id, input.id);
        if (schedule.scheduleType === "weekly_report") return processWeeklyReportSchedule(schedule, { deliver: emailProviderConfigured() });
        if (!emailProviderConfigured()) throw new Error("Set up a verified transactional sender before delivering client follow-ups.");
        return processClientFollowUpSchedule(schedule);
      }),
    }),
    reports: router({
      list: protectedProcedure.query(({ ctx }) => listReportDeliveries(ctx.user.id)),
    }),
  }),
});

export type AppRouter = typeof appRouter;
