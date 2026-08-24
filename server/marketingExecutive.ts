import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { businessProfiles, marketingExecutiveRuns } from "../drizzle/schema";
import { summarizeAnalytics } from "./analytics";
import { getAnalyticsSnapshotsForUser, getDb, reserveMonthlyUsage } from "./db";
import { callDataApi } from "./_core/dataApi";
import { invokeLLM } from "./_core/llm";
import { getPurchaseIntelligence } from "./purchaseIntelligence";
import { getOutcomeSignalEvidence } from "./outcomeSignals";
import { listWorkspacesForUser } from "./workspaces";

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is not available.");
  return db;
}

export type BusinessProfileInput = {
  businessName: string;
  websiteDomain?: string;
  industry: string;
  coreOffer: string;
  targetAudience: string;
  brandVoice: string;
  differentiators?: string;
  strategicGoals?: string;
  marketContext?: string;
  guardrails?: string;
};

export async function getBusinessProfile(userId: number) {
  const db = requireDb(await getDb());
  const [profile] = await db.select().from(businessProfiles).where(eq(businessProfiles.userId, userId)).limit(1);
  return profile || null;
}

export async function saveBusinessProfile(userId: number, input: BusinessProfileInput) {
  const db = requireDb(await getDb());
  await db.insert(businessProfiles).values({
    userId,
    businessName: input.businessName,
    websiteDomain: input.websiteDomain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || null,
    industry: input.industry,
    coreOffer: input.coreOffer,
    targetAudience: input.targetAudience,
    brandVoice: input.brandVoice,
    differentiators: input.differentiators || null,
    strategicGoals: input.strategicGoals || null,
    marketContext: input.marketContext || null,
    guardrails: input.guardrails || null,
  }).onDuplicateKeyUpdate({ set: {
    businessName: input.businessName,
    websiteDomain: input.websiteDomain?.replace(/^https?:\/\//, "").replace(/\/$/, "") || null,
    industry: input.industry,
    coreOffer: input.coreOffer,
    targetAudience: input.targetAudience,
    brandVoice: input.brandVoice,
    differentiators: input.differentiators || null,
    strategicGoals: input.strategicGoals || null,
    marketContext: input.marketContext || null,
    guardrails: input.guardrails || null,
  } });
  return getBusinessProfile(userId);
}

export async function listExecutiveRuns(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(marketingExecutiveRuns).where(eq(marketingExecutiveRuns.userId, userId)).orderBy(desc(marketingExecutiveRuns.createdAt)).limit(20);
}

const responseSchema = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    whatIsWorking: { type: "array", items: { type: "object", properties: { observation: { type: "string" }, evidence: { type: "string" }, implication: { type: "string" } }, required: ["observation", "evidence", "implication"], additionalProperties: false } },
    watchouts: { type: "array", items: { type: "object", properties: { observation: { type: "string" }, evidence: { type: "string" }, response: { type: "string" } }, required: ["observation", "evidence", "response"], additionalProperties: false } },
    nextMove: { type: "object", properties: { title: { type: "string" }, rationale: { type: "string" }, priority: { type: "string", enum: ["now", "next", "watch"] } }, required: ["title", "rationale", "priority"], additionalProperties: false },
    campaignMaterial: { type: "object", properties: { concept: { type: "string" }, headline: { type: "string" }, primaryText: { type: "string" }, cta: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["concept", "headline", "primaryText", "cta", "hashtags"], additionalProperties: false },
    researchBrief: { type: "object", properties: { recommendedQuery: { type: "string" }, sourceNeed: { type: "string" }, caveat: { type: "string" } }, required: ["recommendedQuery", "sourceNeed", "caveat"], additionalProperties: false },
  },
  required: ["executiveSummary", "whatIsWorking", "watchouts", "nextMove", "campaignMaterial", "researchBrief"],
  additionalProperties: false,
};

export async function getMarketSignals(domain?: string | null) {
  if (!domain) return { domain: null, sources: [{ source: "Business profile", signal: "No website domain configured", status: "not_requested" }] };
  const common = { pathParams: { domain }, query: { country: "world", granularity: "monthly", main_domain_only: true } };
  const requests = [
    { source: "Similarweb total visits", apiId: "Similarweb/get_visits_total", options: common },
    { source: "Similarweb bounce rate", apiId: "Similarweb/get_bounce_rate", options: common },
    { source: "Similarweb desktop channels", apiId: "Similarweb/get_traffic_sources_desktop", options: common },
  ];
  const settled = await Promise.allSettled(requests.map(request => callDataApi(request.apiId, request.options)));
  return {
    domain,
    sources: settled.map((result, index) => result.status === "fulfilled"
      ? { source: requests[index].source, status: "available", data: result.value }
      : { source: requests[index].source, status: "unavailable", detail: result.reason instanceof Error ? result.reason.message : "Signal unavailable." }),
  };
}

export async function runMarketingExecutive(input: { userId: number; prompt: string; runType: "campaign_plan" | "performance_review" | "market_signal_review" | "material_refresh" }) {
  const profile = await getBusinessProfile(input.userId);
  if (!profile) throw new Error("Complete the business intelligence profile before using the marketing executive.");
  await reserveMonthlyUsage(input.userId, "assistantRequests");
  const analytics = summarizeAnalytics(await getAnalyticsSnapshotsForUser(input.userId, {}));
  const purchaseIntelligence = await getPurchaseIntelligence(input.userId);
  const [workspace] = await listWorkspacesForUser(input.userId);
  const outcomeSignalEvidence = await getOutcomeSignalEvidence(input.userId, workspace?.workspace.id);
  const marketSignals = await getMarketSignals(profile.websiteDomain);
  const evidence = { verifiedAnalytics: analytics, purchaseIntelligence, outcomeSignalEvidence, marketSignals, generatedAt: new Date().toISOString() };
  const response = await invokeLLM({
    max_tokens: 2200,
    response_format: { type: "json_schema", json_schema: { name: "marketing_executive_output", strict: true, schema: responseSchema } },
    messages: [
      { role: "system", content: "You are a rigorous personal marketing executive. Use the business profile as durable context. Treat only supplied analytics and purchase outcomes as verified internal performance evidence. Treat any supplied website signal as external evidence and name it. Outcome-signal references are audit provenance only and must never be added to, or used to duplicate, purchase revenue totals. Never invent market trends, conversion results, customer research, or source citations. If market evidence is unavailable, say so plainly and convert it into a research brief instead of a claim. Produce an original, concise, commercially useful recommendation. Do not recommend autonomous publishing; all recommendations require owner approval." },
      { role: "user", content: `Business profile:\n${JSON.stringify(profile)}\n\nVerified advertising analytics:\n${JSON.stringify(analytics)}\n\nVerified purchase outcomes (the only revenue totals):\n${JSON.stringify(purchaseIntelligence)}\n\nCross-module outcome-signal provenance (do not add to revenue totals):\n${JSON.stringify(outcomeSignalEvidence)}\n\nSource-attributed market signals:\n${JSON.stringify(marketSignals)}\n\nExecutive request: ${input.prompt}\n\nReturn a decisive but evidence-calibrated response.` },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("The marketing executive returned an invalid response.");
  const output = JSON.parse(content);
  const db = requireDb(await getDb());
  await db.insert(marketingExecutiveRuns).values({ userId: input.userId, profileId: profile.id, prompt: input.prompt, runType: input.runType, outputJson: JSON.stringify(output), evidenceJson: JSON.stringify(evidence) });
  const [run] = await db.select().from(marketingExecutiveRuns).where(and(eq(marketingExecutiveRuns.userId, input.userId), eq(marketingExecutiveRuns.prompt, input.prompt))).orderBy(desc(marketingExecutiveRuns.id)).limit(1);
  return { run, output, evidence };
}
