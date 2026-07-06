import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles, ArrowRight, ArrowLeft, X, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "civicpulse.onboarded.v1";

type Step = {
  title: string;
  body: string;
  icon: typeof Activity;
  tone: string;
  cta?: { label: string; route: string };
  highlight?: string;
};

const steps: Step[] = [
  {
    title: "Welcome to CivicPulse",
    body: "Your live city intelligence cockpit. Fused telemetry, citizen signal, and Gemini-powered reasoning — all in one dashboard.",
    icon: Radio,
    tone: "from-indigo-neon to-teal-neon",
  },
  {
    title: "Operations Dashboard",
    body: "Real-time KPIs, the fused city signal map with toggleable Traffic / Environment / Health layers, and a rolling ingestion stream. Click any KPI to open its 24h summary.",
    icon: Activity,
    tone: "from-emerald-neon to-teal-neon",
    cta: { label: "Open Dashboard", route: "/" },
    highlight: "Dashboard",
  },
  {
    title: "Live Alerts",
    body: "AI-flagged anomalies across every sector. Filter by severity, sector, status, and time range. Automate a response or resolve — every action fires a toast you can undo.",
    icon: AlertTriangle,
    tone: "from-rose-neon to-amber-neon",
    cta: { label: "Open Live Alerts", route: "/alerts" },
    highlight: "Live Alerts",
  },
  {
    title: "Data Analytics",
    body: "Drill into any KPI for sector-level breakdowns, forecasts, and detected anomalies. Every chart is Gemini-grounded and clickable.",
    icon: BarChart3,
    tone: "from-teal-neon to-indigo-neon",
    cta: { label: "Open Data Analytics", route: "/analytics" },
    highlight: "Data Analytics",
  },
  {
    title: "Community Feedback",
    body: "Watch raw citizen text — tweets, forum posts, hotline calls — become sentiment, category, and an automated action plan in real time.",
    icon: MessageSquareText,
    tone: "from-emerald-neon to-indigo-neon",
    cta: { label: "Open Feedback Hub", route: "/feedback" },
    highlight: "Community Feedback",
  },
  {
    title: "AI Decision Assistant",
    body: "Ask anything about your city. Try the Quick Prompts on the right side of the assistant — they're one-tap starting points for the most common operational questions.",
    icon: Sparkles,
    tone: "from-indigo-neon to-teal-neon",
    cta: { label: "Try the Assistant", route: "/assistant" },
    highlight: "AI Decision Assistant",
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!window.localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function onOpen() {
      setIdx(0);
      setOpen(true);
    }
    window.addEventListener("civicpulse:onboarding", onOpen);
    return () => window.removeEventListener("civicpulse:onboarding", onOpen);
  }, []);

  function finish() {
    try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!open) return null;
  const s = steps[idx];
  const Icon = s.icon;
  const last = idx === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/70 backdrop-blur-md p-4 animate-rise">
      {/* Sidebar highlight ring (desktop only) */}
      {s.highlight && (
        <div className="hidden lg:block pointer-events-none fixed inset-y-0 left-0 w-64 border-r-2 border-indigo-neon/40 shadow-[inset_0_0_60px_oklch(0.7_0.2_265_/_0.15)]" />
      )}

      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-indigo-neon/30">
        <button
          onClick={finish}
          className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
          aria-label="Skip walkthrough"
        >
          <X className="h-4 w-4" />
        </button>

        <div className={cn("h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br text-primary-foreground", s.tone)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          Step {idx + 1} of {steps.length}
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>

        {/* Progress dots */}
        <div className="mt-5 flex gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === idx ? "w-8 bg-indigo-neon" : "w-1.5 bg-surface-3 hover:bg-surface-2"
              )}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <button
            onClick={finish}
            className="text-[11px] text-muted-foreground hover:text-foreground mr-auto"
          >
            Skip tour
          </button>
          {idx > 0 && (
            <button
              onClick={() => setIdx((i) => i - 1)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface-2 inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}
          {s.cta && s.cta.route !== pathname && (
            <button
              onClick={() => { navigate({ to: s.cta!.route }); }}
              className="text-xs px-3 py-1.5 rounded-md border border-indigo-neon/40 text-indigo-neon hover:bg-indigo-neon/10 inline-flex items-center gap-1.5"
            >
              {s.cta.label}
            </button>
          )}
          {last ? (
            <button
              onClick={finish}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground hover:brightness-110 inline-flex items-center gap-1.5"
            >
              Start using CivicPulse <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground hover:brightness-110 inline-flex items-center gap-1.5"
            >
              Next <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
