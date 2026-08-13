import sharp from "sharp";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl, storagePut } from "./storage";

export type AdPlatform = "meta" | "tiktok" | "youtube";

export type CampaignBrief = {
  productName: string;
  industry: string;
  targetAudience: string;
  goal: string;
  tone: string;
  platforms: AdPlatform[];
};

export const CREATIVE_SPECS: Array<{
  platform: AdPlatform;
  format: string;
  label: string;
  width: number;
  height: number;
  orientation: string;
}> = [
  { platform: "meta", format: "Feed square", label: "Meta Feed", width: 1080, height: 1080, orientation: "square 1:1" },
  { platform: "meta", format: "Story portrait", label: "Meta Story", width: 1080, height: 1920, orientation: "vertical 9:16" },
  { platform: "tiktok", format: "In-feed portrait", label: "TikTok In-feed", width: 1080, height: 1920, orientation: "vertical 9:16" },
  { platform: "youtube", format: "Video companion", label: "YouTube Companion", width: 1920, height: 1080, orientation: "landscape 16:9" },
];

const campaignResponseSchema = {
  type: "object",
  properties: {
    campaignName: { type: "string" },
    executiveAngle: { type: "string" },
    trendInsights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          signal: { type: "string" },
          whyItMatters: { type: "string" },
          creativeCue: { type: "string" },
        },
        required: ["title", "signal", "whyItMatters", "creativeCue"],
        additionalProperties: false,
      },
    },
    targeting: {
      type: "object",
      properties: {
        coreAudience: { type: "string" },
        segments: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, profile: { type: "string" }, angle: { type: "string" } },
            required: ["name", "profile", "angle"],
            additionalProperties: false,
          },
        },
        exclusions: { type: "array", items: { type: "string" } },
        placements: { type: "array", items: { type: "string" } },
      },
      required: ["coreAudience", "segments", "exclusions", "placements"],
      additionalProperties: false,
    },
    strategy: {
      type: "object",
      properties: {
        objective: { type: "string" },
        hook: { type: "string" },
        offer: { type: "string" },
        ctaStrategy: { type: "string" },
        testingPlan: { type: "array", items: { type: "string" } },
      },
      required: ["objective", "hook", "offer", "ctaStrategy", "testingPlan"],
      additionalProperties: false,
    },
    platforms: {
      type: "object",
      properties: {
        meta: {
          type: "object",
          properties: {
            headline: { type: "string" }, primaryText: { type: "string" }, cta: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, imageDirection: { type: "string" }, videoScript: { type: "string" }, formatNotes: { type: "string" },
          },
          required: ["headline", "primaryText", "cta", "hashtags", "imageDirection", "videoScript", "formatNotes"], additionalProperties: false,
        },
        tiktok: {
          type: "object",
          properties: {
            headline: { type: "string" }, primaryText: { type: "string" }, cta: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, imageDirection: { type: "string" }, videoScript: { type: "string" }, formatNotes: { type: "string" },
          },
          required: ["headline", "primaryText", "cta", "hashtags", "imageDirection", "videoScript", "formatNotes"], additionalProperties: false,
        },
        youtube: {
          type: "object",
          properties: {
            headline: { type: "string" }, primaryText: { type: "string" }, cta: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, imageDirection: { type: "string" }, videoScript: { type: "string" }, formatNotes: { type: "string" },
          },
          required: ["headline", "primaryText", "cta", "hashtags", "imageDirection", "videoScript", "formatNotes"], additionalProperties: false,
        },
      },
      required: ["meta", "tiktok", "youtube"],
      additionalProperties: false,
    },
  },
  required: ["campaignName", "executiveAngle", "trendInsights", "targeting", "strategy", "platforms"],
  additionalProperties: false,
};

export type CampaignBlueprint = {
  campaignName: string;
  executiveAngle: string;
  trendInsights: Array<{ title: string; signal: string; whyItMatters: string; creativeCue: string }>;
  targeting: { coreAudience: string; segments: Array<{ name: string; profile: string; angle: string }>; exclusions: string[]; placements: string[] };
  strategy: { objective: string; hook: string; offer: string; ctaStrategy: string; testingPlan: string[] };
  platforms: Record<AdPlatform, { headline: string; primaryText: string; cta: string; hashtags: string[]; imageDirection: string; videoScript: string; formatNotes: string }>;
};

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "campaign";
}

export function getAssetKeyFromUrl(url: string) {
  return url.replace(/^\/manus-storage\//, "");
}

export async function generateCampaignBlueprint(brief: CampaignBrief): Promise<CampaignBlueprint> {
  const response = await invokeLLM({
    max_tokens: 3600,
    response_format: { type: "json_schema", json_schema: { name: "campaign_pack", strict: true, schema: campaignResponseSchema } },
    messages: [
      {
        role: "system",
        content: "You are the strategy director at an elite performance creative studio. Produce commercially specific advertising recommendations. Trend insights must be framed as timely directional signals, not unverifiable statistics or claims of real-time data. Do not fabricate facts, audience sizes, or performance results. Keep each platform native, original, and compliant with mainstream ad standards.",
      },
      {
        role: "user",
        content: `Create one integrated campaign pack from this brief. Product or brand: ${brief.productName}. Industry: ${brief.industry}. Target audience: ${brief.targetAudience}. Goal: ${brief.goal}. Preferred tone: ${brief.tone}. Prioritized platforms: ${brief.platforms.join(", ")}. Return every requested platform even if it is not prioritized. Ensure copy is concise and format-specific.`,
      },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("The campaign planner returned an invalid response.");
  return JSON.parse(content) as CampaignBlueprint;
}

export async function generateCampaignImages(brief: CampaignBrief, blueprint: CampaignBlueprint, owner: { userId: number; campaignId: number }) {
  const specs = CREATIVE_SPECS.filter(spec => brief.platforms.includes(spec.platform));
  return Promise.all(specs.map(async spec => {
    const direction = blueprint.platforms[spec.platform].imageDirection;
    const prompt = `Create a premium paid social advertising visual for ${brief.productName} in the ${brief.industry} industry. Purpose: ${brief.goal}. Audience: ${brief.targetAudience}. Campaign angle: ${blueprint.executiveAngle}. Art direction: ${direction}. Composition: ${spec.orientation}, a clear focal point, sophisticated depth and texture, and a generous text-safe area. Style: polished editorial commercial photography or art direction, modern, refined, high-contrast enough for mobile viewing. Text/content to render: no text, no logos, no watermarks. Constraints: the image must remain visually coherent when delivered at ${spec.width} by ${spec.height} pixels. Avoid: generic stock-photo poses, clutter, interface mockups, illegible text, trademarked platform logos.`;
    const generated = await generateImage({ prompt, quality: "high" });
    if (!generated.url) throw new Error(`Image generation did not return a ${spec.label} asset.`);
    const sourceKey = getAssetKeyFromUrl(generated.url);
    const sourceUrl = await storageGetSignedUrl(sourceKey);
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error(`Could not prepare the ${spec.label} creative.`);
    const sizedBuffer = await sharp(Buffer.from(await sourceResponse.arrayBuffer()))
      .resize(spec.width, spec.height, { fit: "cover", position: "attention" })
      .png({ compressionLevel: 8 })
      .toBuffer();
    const persisted = await storagePut(
      `campaigns/${owner.userId}/${owner.campaignId}/generated/${slugify(brief.productName)}-${spec.platform}-${spec.width}x${spec.height}.png`,
      sizedBuffer,
      "image/png"
    );
    return {
      platform: spec.platform,
      assetType: "image" as const,
      format: spec.format,
      label: spec.label,
      fileKey: persisted.key,
      fileUrl: persisted.url,
      mimeType: "image/png",
      width: spec.width,
      height: spec.height,
      metadataJson: JSON.stringify({ artDirection: direction, source: "AI image generation" }),
    };
  }));
}
