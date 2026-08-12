import { Check, CircleAlert, ClipboardCheck, Download, Image as ImageIcon } from "lucide-react";
import { getCampaignReadiness } from "@/lib/campaignReadiness";

export function CampaignReadiness({
  campaign,
  output,
  imageAssets,
  hasMotion,
}: {
  campaign: any;
  output: any;
  imageAssets: any[];
  hasMotion: boolean;
}) {
  const readiness = getCampaignReadiness(campaign, output, imageAssets);
  const icons = { "Platform-native copy": ClipboardCheck, "Creative coverage": ImageIcon, "Pack handoff": Download };

  return (
    <section className="rounded-[26px] border border-white/[.09] bg-[#171521]/88 p-6 shadow-2xl shadow-black/10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-200/12 text-rose-200"><ClipboardCheck className="h-5 w-5" /></span><div><p className="text-sm font-semibold">Launch readiness</p><p className="mt-1 max-w-lg text-xs leading-5 text-white/45">A production check derived from the connected launch-console architecture: verify the assets, copy, and handoff state before taking this campaign live.</p></div></div>
        <div className="rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2 text-right"><p className="text-lg font-semibold text-rose-100">{readiness.percentage}%</p><p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/40">production ready</p></div>
      </div>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full bg-gradient-to-r from-rose-200 to-violet-300 transition-all" style={{ width: `${readiness.percentage}%` }} /></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">{readiness.items.map(item => { const Icon = icons[item.label as keyof typeof icons]; return <div key={item.label} className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-white/45" />{item.complete ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.11em] text-emerald-200"><Check className="h-3 w-3" />Ready</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.11em] text-amber-100"><CircleAlert className="h-3 w-3" />Review</span>}</div><p className="mt-5 text-sm font-semibold">{item.label}</p><p className="mt-1 text-xs leading-5 text-white/48">{item.detail}</p></div>; })}</div>
      <p className="mt-5 text-xs text-white/38">Motion layer: {hasMotion ? "Audio-backed motion cut is stored in the campaign pack." : "Optional — render a motion cut when a short-form placement is part of the launch."}</p>
    </section>
  );
}
