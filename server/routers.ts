import { z } from "zod";
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
  setDefaultSavedAnalyticsView,
  updateCampaignOutput,
} from "./db";
import { summarizeAnalytics } from "./analytics";
import { storagePut } from "./storage";

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

function decodeBase64(value: string) {
  const normalized = value.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(normalized, "base64");
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
      const campaign = await createCampaign({ ...input, userId: ctx.user.id });
      try {
        const blueprint = await generateCampaignBlueprint(input);
        const assets = await generateCampaignImages(input, blueprint);
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
      dataBase64: z.string().min(20),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      durationSeconds: z.number().int().positive().max(90).optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getCampaignWithAssets(ctx.user.id, input.campaignId);
      if (!existing) throw new Error("Campaign not found.");
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
      dataBase64: z.string().min(20),
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
});

export type AppRouter = typeof appRouter;
