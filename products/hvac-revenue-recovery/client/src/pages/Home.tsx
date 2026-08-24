// SIGNAL FURNACE DESIGN: premium industrial-editorial layout; furnace orange signals action, charcoal establishes authority, and asymmetric sections turn workflow failures into commercial clarity.
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Menu,
  MoveUpRight,
  PhoneCall,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "The leak", id: "leak" },
  { label: "The system", id: "system" },
  { label: "The pilot", id: "pilot" },
];

const systemLayers = [
  { number: "01", title: "Capture", copy: "Calls, forms, texts, and paid inquiries enter one visible path." },
  { number: "02", title: "Route", copy: "After-hours requests receive permitted intake and a defined next owner." },
  { number: "03", title: "Respond", copy: "Approved acknowledgements create a faster first step without replacing your team." },
  { number: "04", title: "Recover", copy: "Open estimates and missed appointments receive measured, human-routed follow-up." },
  { number: "05", title: "Review", copy: "The owner sees what was answered, chased, booked, or left unresolved." },
];

const workflowViews = {
  afterHours: {
    label: "After-hours inquiries",
    issue: "A customer calls when the office is closed.",
    path: ["Inquiry lands", "Permitted intake", "Named owner", "Next-business-day follow-up"],
    result: "No ambiguous handoff. No invisible lead.",
  },
  webLeads: {
    label: "Web leads",
    issue: "A form is submitted while the team is in the field.",
    path: ["Lead captured", "Immediate acknowledgement", "Staff task created", "Booking route visible"],
    result: "Faster first response—with clear accountability.",
  },
  estimates: {
    label: "Open estimates",
    issue: "A replacement quote is sent and then goes quiet.",
    path: ["Estimate logged", "Approved follow-up", "Reply routed", "Outcome reported"],
    result: "Every open estimate has a next commercial action.",
  },
};

const fitSignals = [
  "You promote emergency, after-hours, repair, replacement, or online booking.",
  "You have enough inbound activity to observe the current customer path.",
  "An owner, GM, or operations lead can approve a focused workflow test.",
  "You want clearer ownership—not another disconnected software subscription.",
];

const faqs = [
  {
    question: "Do I need to replace my CRM or dispatch system?",
    answer: "No. The initial pilot is designed around one workflow and its existing handoffs. The goal is to make that path more visible and reliably owned—not to force a rip-and-replace project.",
  },
  {
    question: "Will the system make technical or safety decisions?",
    answer: "No. The operating model preserves human control. It does not diagnose equipment faults, determine safety, quote work, or promise arrival times. Those decisions stay with the qualified people who own them.",
  },
  {
    question: "What makes a first pilot successful?",
    answer: "A strong pilot has one workflow, one business measure, one internal owner, and one review date. It creates evidence for the next decision rather than a broad automation promise.",
  },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<keyof typeof workflowViews>("afterHours");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [requested, setRequested] = useState(false);
  const workflow = workflowViews[activeWorkflow];

  const requestDiagnostic = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequested(true);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f0e8] text-[#20211f] selection:bg-[#e85d32] selection:text-white">
      <header className="sticky top-0 z-50 border-b border-[#20211f]/10 bg-[#f5f0e8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:px-10">
          <button className="flex items-center gap-3 text-left" onClick={() => scrollToSection("top")} aria-label="Back to top">
            <img src="/manus-storage/hvac-signal-mark_e6374dab.png" alt="HVAC Revenue Recovery signal mark" className="h-10 w-10 object-contain" />
            <span className="font-['Barlow_Condensed'] text-[20px] font-bold uppercase leading-[0.86] tracking-[0.08em] text-[#20211f]">
              HVAC Revenue<br />Recovery
            </span>
          </button>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => scrollToSection(item.id)} className="group text-sm font-semibold text-[#5f615d] transition-colors hover:text-[#20211f]">
                {item.label}
                <span className="mt-1 block h-px w-0 bg-[#e85d32] transition-all duration-200 group-hover:w-full" />
              </button>
            ))}
          </nav>

          <Button onClick={() => scrollToSection("diagnostic")} className="hidden rounded-none bg-[#20211f] px-5 text-sm font-semibold text-white transition-transform duration-150 hover:bg-[#e85d32] active:scale-[0.97] md:inline-flex">
            Request a diagnostic <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <button onClick={() => setMobileOpen((value) => !value)} className="grid h-10 w-10 place-items-center border border-[#20211f]/15 md:hidden" aria-label="Toggle navigation">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-[#20211f]/10 bg-[#f5f0e8] px-5 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} onClick={() => { scrollToSection(item.id); setMobileOpen(false); }} className="text-left font-semibold text-[#20211f]">
                  {item.label}
                </button>
              ))}
              <Button onClick={() => { scrollToSection("diagnostic"); setMobileOpen(false); }} className="mt-2 w-full rounded-none bg-[#20211f] text-white hover:bg-[#e85d32]">
                Request a diagnostic <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden bg-[#20211f] text-[#f8f5ef]">
          <div className="absolute inset-y-0 right-0 w-[57%] bg-[linear-gradient(125deg,transparent_0%,transparent_36%,rgba(232,93,50,0.2)_36.2%,transparent_36.5%,transparent_57%,rgba(232,93,50,0.1)_57.2%,transparent_57.5%)]" />
          <div className="absolute left-[55%] top-0 h-full w-px bg-white/15" />
          <div className="mx-auto grid min-h-[680px] max-w-[1440px] grid-cols-1 items-stretch px-5 md:grid-cols-[0.96fr_1.04fr] md:px-10">
            <div className="relative z-10 flex flex-col justify-between py-16 md:py-20">
              <div>
                <div className="mb-9 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#f07a54]">
                  <span className="h-px w-10 bg-[#e85d32]" />
                  Response & follow-up infrastructure
                </div>
                <h1 className="max-w-[680px] font-['DM_Sans'] text-[clamp(3.4rem,7vw,6.4rem)] font-black italic leading-[0.82] tracking-[-0.075em]">
                  Every inquiry<br />needs an <span className="text-[#e85d32]">owner.</span>
                </h1>
                <p className="mt-9 max-w-[560px] font-['DM_Serif_Display'] text-2xl leading-[1.2] text-[#d9d5cf] md:text-[28px]">
                  We install the operating layer that turns paid HVAC inquiries into visible, owned, booked work.
                </p>
              </div>
              <div className="mt-12 flex flex-col gap-5 sm:flex-row sm:items-center">
                <Button onClick={() => scrollToSection("diagnostic")} className="h-14 rounded-none bg-[#e85d32] px-6 font-bold text-white hover:bg-[#ff744b] active:scale-[0.97]">
                  Map your response gap <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
                <button onClick={() => scrollToSection("system")} className="group flex items-center gap-3 text-sm font-semibold text-[#e8e2db]">
                  See the recovery system <span className="grid h-9 w-9 place-items-center border border-white/20 transition-transform duration-200 group-hover:translate-x-1"><MoveUpRight className="h-4 w-4" /></span>
                </button>
              </div>
            </div>

            <div className="relative z-10 flex min-h-[410px] items-end py-8 md:min-h-0 md:py-10 md:pl-10">
              <div className="relative w-full overflow-hidden border border-white/15 bg-[#2b2d2a]">
                <img src="/manus-storage/hvac-hero-operations_d40d14fc.jpg" alt="HVAC service manager overseeing dispatch operations" className="h-[470px] w-full object-cover md:h-[590px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#20211f]/65 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-5 py-5 md:px-7 md:py-7">
                  <div>
                    <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#f07a54]">Signal captured</p>
                    <p className="mt-2 max-w-[360px] text-lg font-semibold leading-tight">The gap is rarely demand. It is the handoff after demand arrives.</p>
                  </div>
                  <div className="hidden h-14 w-14 items-center justify-center border border-white/30 bg-[#20211f]/55 md:flex"><PhoneCall className="h-5 w-5 text-[#f07a54]" /></div>
                </div>
              </div>
              <div className="absolute -left-3 top-[52%] hidden -translate-y-1/2 border border-[#e85d32] bg-[#20211f] px-4 py-4 md:block">
                <span className="block font-['Barlow_Condensed'] text-[11px] font-bold uppercase tracking-[0.16em] text-[#f07a54]">Operating question</span>
                <span className="mt-1 block max-w-[185px] text-sm font-semibold leading-tight text-white">Can you see what happened to every inquiry?</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10">
            <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-white/10 px-5 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-10">
              {[['01', 'Capture', 'Calls, forms, and texts'], ['02', 'Recover', 'Open estimates and no-shows'], ['03', 'Review', 'Owner visibility by source']].map(([number, title, copy]) => (
                <div key={number} className="flex items-center gap-5 py-5 md:px-7 first:md:pl-0">
                  <span className="font-['Barlow_Condensed'] text-2xl font-bold text-[#e85d32]">{number}</span>
                  <div><p className="font-semibold">{title}</p><p className="mt-0.5 text-sm text-[#b6b1aa]">{copy}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="leak" className="relative scroll-mt-20 bg-[#f5f0e8] py-24 md:py-32">
          <div className="absolute left-0 top-14 hidden h-[calc(100%-112px)] w-2 bg-[#e85d32] md:block" />
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-5 md:grid-cols-[0.75fr_1.25fr] md:px-10">
            <div>
              <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#e85d32]">The revenue leak</p>
              <h2 className="mt-5 font-['DM_Sans'] text-5xl font-black italic leading-[0.86] tracking-[-0.065em] text-[#20211f] md:text-7xl">The money is often lost <span className="text-[#e85d32]">after</span> the lead arrives.</h2>
            </div>
            <div className="grid grid-cols-1 border-t border-[#20211f]/20 sm:grid-cols-3">
              {[
                ["01", "Inbound", "A call, form, text, or paid inquiry creates a chance to serve."],
                ["02", "Handoff", "Voicemail, unclear ownership, delay, or an unworked estimate creates friction."],
                ["03", "Outcome", "The job is booked—or the revenue disappears with no visible reason."],
              ].map(([n, title, copy], index) => (
                <div key={n} className={`relative border-b border-[#20211f]/20 py-7 sm:border-b-0 sm:py-9 ${index !== 0 ? "sm:border-l sm:pl-7" : "sm:pr-7"}`}>
                  <p className="font-['Barlow_Condensed'] text-3xl font-bold text-[#e85d32]">{n}</p>
                  <h3 className="mt-7 text-xl font-black italic">{title}</h3>
                  <p className="mt-3 font-['DM_Serif_Display'] text-lg leading-[1.34] text-[#5f615d]">{copy}</p>
                </div>
              ))}
              <div className="col-span-full mt-8 flex flex-col justify-between gap-5 border-t-[6px] border-[#e85d32] pt-6 sm:flex-row sm:items-end">
                <p className="max-w-[600px] font-['DM_Serif_Display'] text-2xl leading-[1.25] text-[#20211f]">The first job is not “add more automation.” It is <strong className="font-normal text-[#e85d32]">make one high-value handoff visible, owned, and measured.</strong></p>
                <button onClick={() => scrollToSection("diagnostic")} className="inline-flex items-center gap-2 text-sm font-bold text-[#20211f] underline decoration-[#e85d32] decoration-2 underline-offset-8 hover:text-[#e85d32]">Find the first handoff <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </section>

        <section id="system" className="scroll-mt-20 bg-[#d9d4ca] py-24 md:py-32">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <div className="flex flex-col justify-between gap-10 border-b border-[#20211f]/20 pb-10 md:flex-row md:items-end">
              <div className="max-w-[720px]">
                <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#e85d32]">The recovery system</p>
                <h2 className="mt-5 font-['DM_Sans'] text-5xl font-black italic leading-[0.88] tracking-[-0.065em] text-[#20211f] md:text-7xl">A system around the work your team already does.</h2>
              </div>
              <p className="max-w-[330px] font-['DM_Serif_Display'] text-xl leading-[1.3] text-[#4e504c]">No rip-and-replace project. No unattended technical advice. Just a stronger path from inquiry to next action.</p>
            </div>

            <div className="mt-12 grid grid-cols-1 divide-y divide-[#20211f]/20 border-y border-[#20211f]/20 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
              {systemLayers.map((layer) => (
                <article key={layer.number} className="group min-h-[255px] px-0 py-7 lg:px-5 lg:first:pl-0">
                  <div className="flex items-center justify-between"><span className="font-['Barlow_Condensed'] text-2xl font-bold text-[#e85d32]">{layer.number}</span><span className="h-px w-8 bg-[#20211f]/20 transition-all duration-200 group-hover:w-12 group-hover:bg-[#e85d32]" /></div>
                  <h3 className="mt-16 text-[26px] font-black italic tracking-[-0.04em]">{layer.title}</h3>
                  <p className="mt-3 font-['DM_Serif_Display'] text-lg leading-[1.3] text-[#51534e]">{layer.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#20211f] py-24 text-white md:py-32">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 md:grid-cols-[0.77fr_1.23fr] md:px-10">
            <div className="relative overflow-hidden border border-white/15 bg-[#2b2d2a]">
              <img src="/manus-storage/hvac-system-handoff_7b4736b3.jpg" alt="HVAC technician managing service work with a phone and clipboard" className="h-[430px] w-full object-cover md:h-[600px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#20211f]/75 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-7"><p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#f07a54]">Human controlled</p><p className="mt-2 max-w-[280px] text-xl font-bold leading-tight">The system supports the people who carry the operation.</p></div>
            </div>
            <div className="py-4 md:py-10">
              <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#f07a54]">Choose a workflow to inspect</p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-b border-white/15 pb-5">
                {(Object.keys(workflowViews) as Array<keyof typeof workflowViews>).map((key) => (
                  <button key={key} onClick={() => setActiveWorkflow(key)} className={`border-b-2 pb-1 text-sm font-bold transition-colors ${activeWorkflow === key ? "border-[#e85d32] text-white" : "border-transparent text-[#aaa69f] hover:text-white"}`}>{workflowViews[key].label}</button>
                ))}
              </div>
              <p className="mt-12 font-['DM_Serif_Display'] text-[32px] leading-[1.15] text-[#f4f0ea] md:text-[42px]">{workflow.issue}</p>
              <div className="mt-11 grid grid-cols-2 gap-x-7 gap-y-7 sm:grid-cols-4">
                {workflow.path.map((item, index) => (
                  <div key={item} className="border-t border-white/20 pt-4"><span className="font-['Barlow_Condensed'] text-lg font-bold text-[#e85d32]">0{index + 1}</span><p className="mt-3 text-sm font-semibold leading-[1.25] text-[#d6d0c8]">{item}</p></div>
                ))}
              </div>
              <div className="mt-12 border-l-[5px] border-[#e85d32] pl-5"><p className="font-['DM_Serif_Display'] text-2xl leading-[1.22] text-[#dcd7d0]">{workflow.result}</p></div>
            </div>
          </div>
        </section>

        <section id="pilot" className="scroll-mt-20 bg-[#f5f0e8] py-24 md:py-32">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-14 px-5 md:grid-cols-[0.82fr_1.18fr] md:px-10">
            <div>
              <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#e85d32]">The first proof</p>
              <h2 className="mt-5 font-['DM_Sans'] text-5xl font-black italic leading-[0.86] tracking-[-0.065em] md:text-7xl">A paid pilot built for a <span className="text-[#e85d32]">real decision.</span></h2>
              <p className="mt-8 max-w-[480px] font-['DM_Serif_Display'] text-2xl leading-[1.28] text-[#555752]">The first 30 days establish whether one operational leak is painful enough—and measurable enough—to fix.</p>
            </div>
            <div className="space-y-0 border-t border-[#20211f]/20">
              {[
                ["01", "One workflow", "After-hours intake, web-lead response, or open-estimate follow-up—not a broad transformation project."],
                ["02", "One commercial measure", "Response time, contacted-lead rate, estimate re-engagement, appointment show rate, or administrative time removed."],
                ["03", "One accountable owner", "A named client-side lead approves rules, routes exceptions, and reviews the result."],
                ["04", "One review date", "The pilot ends with operating evidence and a straightforward decision: stop, refine, or standardize."],
              ].map(([n, title, copy]) => (
                <div key={n} className="grid grid-cols-[72px_1fr] gap-5 border-b border-[#20211f]/20 py-6 md:grid-cols-[90px_0.55fr_1fr] md:gap-8"><span className="font-['Barlow_Condensed'] text-3xl font-bold text-[#e85d32]">{n}</span><h3 className="text-2xl font-black italic tracking-[-0.04em]">{title}</h3><p className="col-start-2 font-['DM_Serif_Display'] text-lg leading-[1.32] text-[#5b5d58] md:col-start-auto">{copy}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#e85d32] py-20 text-white md:py-24">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 md:grid-cols-[1fr_0.82fr] md:px-10">
            <div><p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-white/75">Before we talk</p><h2 className="mt-5 max-w-[700px] font-['DM_Sans'] text-5xl font-black italic leading-[0.86] tracking-[-0.065em] md:text-7xl">Built for teams ready to make the handoff visible.</h2></div>
            <ul className="grid gap-5 self-end">
              {fitSignals.map((signal) => <li key={signal} className="flex gap-4 border-t border-white/35 pt-4 font-['DM_Serif_Display'] text-xl leading-[1.25]"><Check className="mt-1 h-4 w-4 shrink-0" />{signal}</li>)}
            </ul>
          </div>
        </section>

        <section className="bg-[#20211f] py-24 text-white md:py-32">
          <div className="mx-auto max-w-[1440px] px-5 md:px-10">
            <div className="flex flex-col justify-between gap-8 border-b border-white/15 pb-10 md:flex-row md:items-end"><div><p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#f07a54]">The proof desk</p><h2 className="mt-5 max-w-[680px] font-['DM_Sans'] text-5xl font-black italic leading-[0.88] tracking-[-0.065em] md:text-7xl">Evidence before <span className="text-[#e85d32]">claims.</span></h2></div><p className="max-w-[330px] font-['DM_Serif_Display'] text-xl leading-[1.3] text-[#c3beb7]">No invented success stories. The first case evidence is built from a measured pilot and the operator’s own data.</p></div>
            <div className="grid grid-cols-1 divide-y divide-white/15 border-b border-white/15 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[['Baseline', 'Map the current path and establish the one metric that matters.'], ['Operating evidence', 'Document what was captured, routed, followed up, or recovered.'], ['Client-approved proof', 'Publish only the evidence and language the operating team confirms.']].map(([title, copy], index) => <div key={title} className="py-8 md:px-7 first:md:pl-0"><span className="font-['Barlow_Condensed'] text-xl font-bold text-[#e85d32]">0{index + 1}</span><h3 className="mt-8 text-2xl font-black italic">{title}</h3><p className="mt-3 font-['DM_Serif_Display'] text-lg leading-[1.3] text-[#c3beb7]">{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section id="diagnostic" className="scroll-mt-20 bg-[#f5f0e8] py-24 md:py-32">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-14 px-5 md:grid-cols-[0.78fr_1.22fr] md:px-10">
            <div>
              <p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#e85d32]">Request a response-gap diagnostic</p>
              <h2 className="mt-5 font-['DM_Sans'] text-5xl font-black italic leading-[0.87] tracking-[-0.065em] md:text-7xl">Map the handoff.<br /><span className="text-[#e85d32]">Recover the work.</span></h2>
              <p className="mt-8 max-w-[420px] font-['DM_Serif_Display'] text-2xl leading-[1.28] text-[#5b5d58]">A focused first conversation about the one customer path most worth making visible.</p>
              <div className="mt-12 space-y-5 border-t border-[#20211f]/20 pt-6">
                {[['20 min', 'Practical response-gap conversation'], ['1 workflow', 'After-hours, web leads, or open estimates'], ['0 hype', 'A decision-ready operating map']].map(([value, label]) => <div key={value} className="flex items-center gap-4"><span className="min-w-[64px] font-['Barlow_Condensed'] text-2xl font-bold text-[#e85d32]">{value}</span><span className="text-sm font-semibold text-[#5e605b]">{label}</span></div>)}
              </div>
            </div>
            <form onSubmit={requestDiagnostic} className="border-t-[7px] border-[#e85d32] bg-[#ded9d0] p-6 md:p-10">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block text-sm font-bold">Your name<input required name="name" className="mt-3 h-12 w-full border-b border-[#20211f]/35 bg-transparent px-0 text-base outline-none transition-colors placeholder:text-[#777973] focus:border-[#e85d32]" placeholder="Name" /></label>
                <label className="block text-sm font-bold">Company<input required name="company" className="mt-3 h-12 w-full border-b border-[#20211f]/35 bg-transparent px-0 text-base outline-none transition-colors placeholder:text-[#777973] focus:border-[#e85d32]" placeholder="HVAC company" /></label>
                <label className="block text-sm font-bold">Work email<input required type="email" name="email" className="mt-3 h-12 w-full border-b border-[#20211f]/35 bg-transparent px-0 text-base outline-none transition-colors placeholder:text-[#777973] focus:border-[#e85d32]" placeholder="name@company.com" /></label>
                <label className="block text-sm font-bold">Primary workflow<select name="workflow" className="mt-3 h-12 w-full border-b border-[#20211f]/35 bg-transparent px-0 text-base outline-none focus:border-[#e85d32]"><option>After-hours inquiries</option><option>Web lead response</option><option>Open estimate follow-up</option><option>Not sure yet</option></select></label>
              </div>
              <label className="mt-8 block text-sm font-bold">What is hardest to see today?<textarea name="challenge" className="mt-3 min-h-[115px] w-full border border-[#20211f]/20 bg-[#f5f0e8]/55 p-4 text-base outline-none transition-colors placeholder:text-[#777973] focus:border-[#e85d32]" placeholder="For example: we do not know who calls back after hours, or which estimates have gone quiet." /></label>
              <Button type="submit" className="mt-8 h-14 w-full rounded-none bg-[#20211f] text-base font-bold text-white hover:bg-[#e85d32] active:scale-[0.98]">Request the response-gap map <ArrowRight className="ml-3 h-5 w-5" /></Button>
              {requested && <div className="mt-6 border-l-4 border-[#e85d32] bg-[#f5f0e8] p-4 text-sm leading-relaxed text-[#454741]"><strong className="block text-[#20211f]">Your diagnostic brief is ready to be routed.</strong> This static preview confirms the request locally. Connect the form to your preferred scheduling or lead-capture service before public launch.</div>}
              <p className="mt-5 text-xs leading-relaxed text-[#686a65]">This conversation is designed to clarify one workflow. It does not replace licensed trade, safety, pricing, or customer-communication decisions.</p>
            </form>
          </div>
        </section>

        <section className="bg-[#ded9d0] py-20">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-5 md:grid-cols-[0.8fr_1.2fr] md:px-10">
            <div><p className="font-['Barlow_Condensed'] text-xs font-bold uppercase tracking-[0.2em] text-[#e85d32]">Practical questions</p><h2 className="mt-5 font-['DM_Sans'] text-5xl font-black italic leading-[0.88] tracking-[-0.065em]">No black box.<br />No loose ends.</h2></div>
            <div className="border-t border-[#20211f]/20">
              {faqs.map((faq, index) => <div key={faq.question} className="border-b border-[#20211f]/20"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-6 py-6 text-left"><span className="text-xl font-black italic tracking-[-0.03em]">{faq.question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-[#e85d32] transition-transform duration-200 ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <p className="max-w-[720px] pb-6 font-['DM_Serif_Display'] text-xl leading-[1.32] text-[#595b56]">{faq.answer}</p>}</div>)}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#20211f] text-[#d4cec6]">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-5 py-10 md:flex-row md:items-end md:px-10">
          <div className="flex items-center gap-3"><img src="/manus-storage/hvac-signal-mark_e6374dab.png" alt="" className="h-9 w-9 object-contain" /><span className="font-['Barlow_Condensed'] text-lg font-bold uppercase leading-[0.86] tracking-[0.1em]">HVAC Revenue<br />Recovery</span></div>
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#aaa69f]">{NAV_ITEMS.map((item) => <button key={item.id} onClick={() => scrollToSection(item.id)} className="hover:text-white">{item.label}</button>)}<button onClick={() => scrollToSection("diagnostic")} className="text-[#f07a54] hover:text-white">Request a diagnostic</button></div>
          <p className="text-xs text-[#77736d]">Every inquiry deserves a next step.</p>
        </div>
      </footer>
    </div>
  );
}
