import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Archive, ArrowUpRight, Check, ChevronRight, Clapperboard, Download, Image as ImageIcon, Lightbulb, Loader2, Play, Sparkles, Target, TrendingUp, WandSparkles } from "lucide-react";

type Platform = "meta" | "tiktok" | "youtube";
type CampaignData = any;

const platformMeta: Record<Platform, { label: string; accent: string; description: string }> = {
  meta: { label: "Meta", accent: "bg-[#788dff]", description: "Feed, story, and social placements" },
  tiktok: { label: "TikTok", accent: "bg-[#ee6e9f]", description: "Native vertical-first discovery" },
  youtube: { label: "YouTube", accent: "bg-[#eabc65]", description: "Video companion and action paths" },
};

const goals = ["Drive conversions", "Build awareness", "Grow consideration", "Launch an offer"];
const tones = ["Bold and optimistic", "Refined and premium", "Playful and social-first", "Expert and reassuring"];

function safeJson(value?: string | null) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

function fileBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function coverDraw(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, scale: number) {
  const ratio = Math.max(width / image.width, height / image.height) * scale;
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const requestedId = Number(new URLSearchParams(search).get("campaign"));
  const [brief, setBrief] = useState({ productName: "", industry: "", targetAudience: "", goal: goals[0], tone: tones[1], platforms: ["meta", "tiktok", "youtube"] as Platform[] });
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [renderingMotion, setRenderingMotion] = useState(false);
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();
  const campaignQuery = trpc.campaign.get.useQuery({ id: requestedId || 1 }, { enabled: Boolean(requestedId) });
  const generate = trpc.campaign.generate.useMutation();
  const saveMedia = trpc.campaign.saveGeneratedMedia.useMutation();
  const saveExport = trpc.campaign.saveExport.useMutation();

  useEffect(() => {
    if (campaignQuery.data) setCampaign(campaignQuery.data);
  }, [campaignQuery.data]);

  const output = useMemo(() => safeJson(campaign?.insightsJson), [campaign?.insightsJson]);
  const assets = campaign?.assets || [];
  const imageAssets = assets.filter((asset: any) => asset.assetType === "image");
  const videoAsset = assets.find((asset: any) => asset.assetType === "video");

  const changeBrief = (field: string, value: string | Platform[]) => setBrief(previous => ({ ...previous, [field]: value }));
  const togglePlatform = (platform: Platform) => {
    setBrief(previous => ({ ...previous, platforms: previous.platforms.includes(platform) ? previous.platforms.filter(item => item !== platform) : [...previous.platforms, platform] }));
  };

  const generateCampaign = async () => {
    if (!brief.productName || !brief.industry || brief.targetAudience.length < 10 || brief.platforms.length === 0) {
      toast.error("Complete the campaign brief and select at least one platform.");
      return;
    }
    try {
      const result = await generate.mutateAsync(brief);
      setCampaign(result);
      setLocation(`/?campaign=${result.id}`);
      void utils.campaign.list.invalidate();
      toast.success("Your campaign pack is ready for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Campaign generation did not complete.");
    }
  };

  const renderMotionCut = async () => {
    const source = imageAssets.find((asset: any) => asset.height > asset.width) || imageAssets[0];
    if (!campaign || !source) return;
    if (!("MediaRecorder" in window)) { toast.error("This browser does not support motion rendering."); return; }
    setRenderingMotion(true);
    try {
      const response = await fetch(source.fileUrl);
      const imageBlob = await response.blob();
      const image = new Image();
      const objectUrl = URL.createObjectURL(imageBlob);
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable.");
      const visualStream = canvas.captureStream(30);
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      const master = audioContext.createGain();
      master.gain.setValueAtTime(0.0001, audioContext.currentTime);
      master.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.35);
      master.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 5.3);
      master.connect(audioDestination);
      [110, 165, 220].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = index === 0 ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        gain.gain.setValueAtTime(index === 0 ? 0.12 : 0.045, audioContext.currentTime);
        oscillator.connect(gain); gain.connect(master); oscillator.start(); oscillator.stop(audioContext.currentTime + 5.6);
      });
      const stream = new MediaStream([...visualStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        recorder.onerror = () => reject(new Error("Motion render failed."));
      });
      const started = performance.now();
      const duration = 5600;
      const draw = (now: number) => {
        const elapsed = Math.min(now - started, duration);
        const progress = elapsed / duration;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        coverDraw(ctx, image, canvas.width, canvas.height, 1 + progress * 0.09);
        const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
        shade.addColorStop(0, "rgba(11, 9, 20, .15)"); shade.addColorStop(.58, "rgba(11, 9, 20, 0)"); shade.addColorStop(1, "rgba(11, 9, 20, .76)");
        ctx.fillStyle = shade; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.font = "600 28px Manrope, sans-serif"; ctx.letterSpacing = "5px"; ctx.fillText("PULSEFORGE MOTION CUT", 76, 145);
        ctx.fillStyle = "#fff"; ctx.font = "62px 'DM Serif Display', Georgia, serif"; ctx.letterSpacing = "0px"; ctx.fillText(campaign.productName, 76, 1720);
        ctx.font = "500 28px Manrope, sans-serif"; ctx.fillStyle = "rgba(255,255,255,.78)"; ctx.fillText(output?.platforms?.tiktok?.headline || "Make the next move.", 76, 1774);
        ctx.fillStyle = "#ffd6e3"; ctx.fillRect(76, 1834, Math.max(60, 928 * progress), 6);
        if (elapsed < duration) requestAnimationFrame(draw); else recorder.stop();
      };
      recorder.start(250); requestAnimationFrame(draw);
      const video = await finished;
      visualStream.getTracks().forEach(track => track.stop()); audioContext.close(); URL.revokeObjectURL(objectUrl);
      const asset = await saveMedia.mutateAsync({ campaignId: campaign.id, platform: "tiktok", assetType: "video", format: "6-second audio motion cut", label: "TikTok Motion Cut", fileName: `${campaign.productName}-motion-cut.webm`, mimeType: "video/webm", dataBase64: await fileBase64(video), width: 1080, height: 1920, durationSeconds: 6 });
      if (asset) setCampaign((previous: any) => previous ? { ...previous, assets: [asset, ...previous.assets] } : previous);
      toast.success("Motion cut rendered with an embedded audio bed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Motion render did not complete.");
    } finally { setRenderingMotion(false); }
  };

  const exportPack = async () => {
    if (!campaign) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const sheet = [`# ${campaign.campaignName || campaign.productName}`, "", `Brand: ${campaign.productName}`, `Objective: ${campaign.goal}`, `Audience: ${campaign.targetAudience}`, `Tone: ${campaign.tone}`, "", "## Campaign angle", output?.executiveAngle || "", "", "## Platform copy", ""];
      (["meta", "tiktok", "youtube"] as Platform[]).forEach(platform => {
        const copy = output?.platforms?.[platform]; if (!copy) return;
        sheet.push(`### ${platformMeta[platform].label}`, `Headline: ${copy.headline}`, `Primary text: ${copy.primaryText}`, `CTA: ${copy.cta}`, `Hashtags: ${copy.hashtags?.join(" ") || ""}`, `Format notes: ${copy.formatNotes}`, "");
      });
      sheet.push("## Strategy", output?.strategy?.objective || "", output?.strategy?.hook || "", output?.strategy?.testingPlan?.map((item: string) => `- ${item}`).join("\n") || "");
      zip.file("copy-sheet.md", sheet.join("\n"));
      await Promise.all(assets.map(async (asset: any) => {
        const file = await fetch(asset.fileUrl); if (!file.ok) throw new Error(`Could not bundle ${asset.label}.`);
        const extension = asset.mimeType.includes("webm") ? "webm" : asset.mimeType.includes("png") ? "png" : "bin";
        zip.file(`assets/${asset.platform}-${asset.format.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`, await file.blob());
      }));
      const base64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
      const exportFile = await saveExport.mutateAsync({ campaignId: campaign.id, fileName: `${campaign.productName}-campaign-pack.zip`, dataBase64: base64 });
      setCampaign((previous: any) => previous ? { ...previous, exportKey: exportFile.key, exportUrl: exportFile.url } : previous);
      const link = document.createElement("a"); link.href = exportFile.url; link.download = `${campaign.productName}-campaign-pack.zip`; link.click();
      toast.success("Campaign pack saved and downloaded.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Campaign export did not complete."); } finally { setExporting(false); }
  };

  return (
    <div className="min-h-screen text-white pulse-grid">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5 sm:px-9"><div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-200/70">Creative intelligence</p><h1 className="mt-1 font-display text-2xl tracking-tight">Campaign production desk</h1></div><Button variant="outline" onClick={() => setLocation("/history")} className="border-white/10 bg-white/[0.03] text-white hover:bg-white/10 hover:text-white"><Archive className="mr-2 h-4 w-4" />Library</Button></header>
      <main className="mx-auto w-full max-w-[1480px] px-5 py-8 sm:px-8 lg:px-10">
        <section className="mb-8 grid gap-7 xl:grid-cols-[1.05fr_.95fr]">
          <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rose-200">Brief to campaign pack</p><h2 className="max-w-3xl font-display text-4xl leading-[1.04] tracking-[-0.03em] sm:text-5xl">Build the campaign your market is ready to see.</h2><p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/58">One considered brief becomes platform-native copy, market signals, targeting direction, sized creative assets, and an exportable production package.</p></div>
          <div className="relative overflow-hidden rounded-[26px] border border-rose-200/15 bg-gradient-to-br from-rose-300/15 via-violet-400/10 to-transparent p-6"><Sparkles className="absolute right-6 top-6 h-6 w-6 text-rose-200" /><p className="text-xs font-bold uppercase tracking-[.18em] text-rose-100/70">The PulseForge method</p><p className="mt-5 max-w-sm font-display text-2xl leading-tight">Strategic thinking, coherent creative, and platform-ready execution in one focused flow.</p><div className="mt-7 flex gap-2 text-[11px] font-semibold text-white/60"><span className="rounded-full border border-white/10 px-3 py-1">Meta</span><span className="rounded-full border border-white/10 px-3 py-1">TikTok</span><span className="rounded-full border border-white/10 px-3 py-1">YouTube</span></div></div>
        </section>
        <section className="grid gap-7 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="h-fit rounded-[26px] border border-white/[0.09] bg-[#171521]/88 p-6 shadow-2xl shadow-black/15 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between"><div><p className="text-sm font-semibold">Campaign brief</p><p className="mt-1 text-xs text-white/45">The inputs that shape every output.</p></div><span className="grid h-8 w-8 place-items-center rounded-full bg-rose-200 text-xs font-bold text-[#2b2031]">01</span></div>
            <div className="space-y-4">
              <div><Label htmlFor="product" className="text-xs text-white/65">Product or brand</Label><Input id="product" value={brief.productName} onChange={event => changeBrief("productName", event.target.value)} placeholder="e.g. Luma Skincare" className="mt-2 border-white/10 bg-white/[0.045] text-white placeholder:text-white/25" /></div>
              <div><Label htmlFor="industry" className="text-xs text-white/65">Industry</Label><Input id="industry" value={brief.industry} onChange={event => changeBrief("industry", event.target.value)} placeholder="e.g. Beauty and wellness" className="mt-2 border-white/10 bg-white/[0.045] text-white placeholder:text-white/25" /></div>
              <div><Label htmlFor="audience" className="text-xs text-white/65">Target audience</Label><Textarea id="audience" value={brief.targetAudience} onChange={event => changeBrief("targetAudience", event.target.value)} placeholder="Describe their mindset, context, and need." className="mt-2 min-h-[88px] border-white/10 bg-white/[0.045] text-white placeholder:text-white/25" /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label className="text-xs text-white/65">Goal</Label><select value={brief.goal} onChange={event => changeBrief("goal", event.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#201d2b] px-3 text-xs text-white outline-none focus:ring-2 focus:ring-rose-200/60">{goals.map(goal => <option key={goal}>{goal}</option>)}</select></div><div><Label className="text-xs text-white/65">Tone</Label><select value={brief.tone} onChange={event => changeBrief("tone", event.target.value)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#201d2b] px-3 text-xs text-white outline-none focus:ring-2 focus:ring-rose-200/60">{tones.map(tone => <option key={tone}>{tone}</option>)}</select></div></div>
              <div><Label className="text-xs text-white/65">Platforms</Label><div className="mt-2 grid grid-cols-3 gap-2">{(Object.keys(platformMeta) as Platform[]).map(platform => <button type="button" key={platform} onClick={() => togglePlatform(platform)} className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${brief.platforms.includes(platform) ? "border-rose-200/50 bg-rose-200/15 text-white" : "border-white/10 bg-white/[.03] text-white/45 hover:bg-white/[.07]"}`}>{brief.platforms.includes(platform) && <Check className="mr-1 inline h-3 w-3" />}{platformMeta[platform].label}</button>)}</div></div>
              <Button onClick={generateCampaign} disabled={generate.isPending} className="mt-2 h-12 w-full rounded-xl bg-gradient-to-r from-rose-200 to-violet-300 font-semibold text-[#241a2b] hover:from-rose-100 hover:to-violet-200">{generate.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating campaign pack...</> : <><WandSparkles className="mr-2 h-4 w-4" />Generate campaign pack</>}</Button>
            </div>
          </div>
          {!campaign ? <EmptyCampaignState /> : <CampaignPack campaign={campaign} output={output} imageAssets={imageAssets} videoAsset={videoAsset} renderingMotion={renderingMotion} exporting={exporting} onRenderMotion={renderMotionCut} onExport={exportPack} />}
        </section>
      </main>
    </div>
  );
}

function EmptyCampaignState() {
  return <div className="relative overflow-hidden rounded-[30px] border border-white/[0.09] bg-[#15131e]/80 p-7 shadow-2xl shadow-black/10"><div className="absolute -right-28 -top-24 h-72 w-72 rounded-full bg-violet-400/12 blur-3xl" /><div className="relative flex h-full min-h-[560px] flex-col justify-between"><div className="flex items-start justify-between"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-white/55"><Sparkles className="h-3.5 w-3.5 text-rose-200" />Ready when you are</span><h3 className="mt-6 max-w-lg font-display text-4xl leading-[1.08]">Your campaign desk is waiting for a brief.</h3><p className="mt-4 max-w-lg text-sm leading-7 text-white/52">Bring the brand context. PulseForge will structure the thinking, creative direction, and delivery formats around it.</p></div><div className="hidden h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-rose-200 sm:grid"><ArrowUpRight /></div></div><div className="grid gap-3 sm:grid-cols-3">{[{ icon: TrendingUp, title: "Read the moment", text: "Timely market signals" }, { icon: Target, title: "Find the audience", text: "Practical targeting" }, { icon: ImageIcon, title: "Build the assets", text: "Sized visual creative" }].map(item => <div key={item.title} className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><item.icon className="h-4 w-4 text-rose-200" /><p className="mt-5 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-white/42">{item.text}</p></div>)}</div></div></div>;
}

function CampaignPack({ campaign, output, imageAssets, videoAsset, renderingMotion, exporting, onRenderMotion, onExport }: { campaign: CampaignData; output: any; imageAssets: any[]; videoAsset: any; renderingMotion: boolean; exporting: boolean; onRenderMotion: () => void; onExport: () => void }) {
  return <div className="space-y-5"><section className="overflow-hidden rounded-[30px] border border-white/[.09] bg-[#171521]/88 shadow-2xl shadow-black/15"><div className="relative border-b border-white/[.08] p-7"><div className="absolute right-0 top-0 h-40 w-72 bg-gradient-to-br from-violet-400/18 to-transparent blur-2xl" /><div className="relative flex flex-col justify-between gap-6 lg:flex-row"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-rose-200/75">Campaign pack · {campaign.status}</p><h3 className="mt-3 max-w-2xl font-display text-4xl leading-tight">{campaign.campaignName || campaign.productName}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-white/55">{output?.executiveAngle}</p></div><div className="flex shrink-0 items-start gap-2"><Button onClick={onRenderMotion} disabled={renderingMotion || Boolean(videoAsset)} variant="outline" className="border-white/10 bg-white/[.035] text-white hover:bg-white/10 hover:text-white">{renderingMotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}{videoAsset ? "Motion cut ready" : "Render motion cut"}</Button><Button onClick={onExport} disabled={exporting} className="bg-white text-[#1c1726] hover:bg-rose-50">{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export pack</Button></div></div></div>
    <div className="grid gap-4 p-6 md:grid-cols-3"><Stat label="Creative assets" value={String(imageAssets.length)} note="True platform formats" /><Stat label="Direction" value={campaign.platforms ? JSON.parse(campaign.platforms).length.toString() : "0"} note="Selected channels" /><Stat label="Production" value={videoAsset ? "Motion ready" : "Still-led"} note={videoAsset ? "Audio embedded" : "Render 6-sec cut"} /></div></section>
    <section className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-[26px] border border-white/[.09] bg-[#171521]/88 p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold">Creative assets</p><p className="mt-1 text-xs text-white/42">AI-generated and persisted in your campaign pack.</p></div><span className="text-xs text-white/40">{imageAssets.length} visuals</span></div><div className="grid gap-3 sm:grid-cols-2">{imageAssets.map((asset: any) => <a key={asset.id} href={asset.fileUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/[.08] bg-black/20"><div className={`relative overflow-hidden ${asset.height > asset.width ? "aspect-[9/12]" : asset.width === asset.height ? "aspect-square" : "aspect-video"}`}><img src={asset.fileUrl} alt={`${asset.label} creative`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-10"><p className="text-sm font-semibold">{asset.label}</p><p className="mt-1 text-[11px] text-white/65">{asset.width} × {asset.height}</p></div></div></a>)}</div>{videoAsset && <a href={videoAsset.fileUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between rounded-2xl border border-rose-200/20 bg-rose-200/10 p-4 text-sm text-rose-50"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-200 text-[#2b2031]"><Play className="h-4 w-4 fill-current" /></span><span><b className="block">{videoAsset.label}</b><small className="text-rose-100/65">6 seconds · audio bed included</small></span></span><ChevronRight className="h-4 w-4" /></a>}</div>
      <div className="space-y-5"><InsightCard icon={TrendingUp} eyebrow="Trend signals" title="What is moving now" items={output?.trendInsights?.map((item: any) => item.title)} /><InsightCard icon={Target} eyebrow="Targeting" title={output?.targeting?.coreAudience || "Audience direction"} items={output?.targeting?.segments?.map((item: any) => `${item.name} — ${item.angle}`)} /></div></section>
    <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-[26px] border border-white/[.09] bg-[#171521]/88 p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-300/15 text-violet-200"><Lightbulb className="h-4 w-4" /></span><div><p className="text-sm font-semibold">Strategy prescription</p><p className="mt-1 text-xs text-white/42">Built around the brief, not boilerplate.</p></div></div><div className="mt-6 space-y-4">{[["Objective", output?.strategy?.objective], ["Hook", output?.strategy?.hook], ["CTA approach", output?.strategy?.ctaStrategy]].map(([label, content]) => <div key={String(label)}><p className="text-[10px] font-bold uppercase tracking-[.16em] text-rose-200/60">{label}</p><p className="mt-1 text-sm leading-6 text-white/70">{content}</p></div>)}</div></div>
      <div className="rounded-[26px] border border-white/[.09] bg-[#171521]/88 p-6"><p className="text-sm font-semibold">Platform-native copy</p><div className="mt-5 space-y-3">{(["meta", "tiktok", "youtube"] as Platform[]).map(platform => { const copy = output?.platforms?.[platform]; if (!copy) return null; return <div key={platform} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.15em] text-white/45">{platformMeta[platform].label}</span><span className={`h-2 w-2 rounded-full ${platformMeta[platform].accent}`} /></div><p className="mt-3 font-display text-xl">{copy.headline}</p><p className="mt-2 text-sm leading-6 text-white/58">{copy.primaryText}</p><div className="mt-3 flex items-center justify-between text-xs"><span className="font-semibold text-rose-200">{copy.cta}</span><span className="max-w-[50%] truncate text-white/35">{copy.hashtags?.join(" ")}</span></div></div>; })}</div></div>
    </section></div>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-white/[.07] bg-white/[.03] px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/38">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-white/42">{note}</p></div>; }
function InsightCard({ icon: Icon, eyebrow, title, items }: { icon: any; eyebrow: string; title: string; items?: string[] }) { return <div className="rounded-[26px] border border-white/[.09] bg-[#171521]/88 p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-200/12 text-rose-200"><Icon className="h-4 w-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/38">{eyebrow}</p><p className="mt-1 text-sm font-semibold">{title}</p></div></div><div className="mt-5 space-y-3">{items?.slice(0, 3).map(item => <p key={item} className="border-l border-rose-200/40 pl-3 text-xs leading-5 text-white/58">{item}</p>)}</div></div>; }
