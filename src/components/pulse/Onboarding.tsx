import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles, ArrowRight, ArrowLeft, X, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
    cta: { label: "Open Dashboard", route: "/dashboard" },
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
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(KEY) || window.sessionStorage.getItem(KEY);
      if (!seen) setOpen(true);
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

  // Focus management: capture last focus, move focus into dialog, restore on close.
  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null;
    const t = requestAnimationFrame(() => primaryRef.current?.focus());
    // Lock body scroll while dialog is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = prevOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Refocus primary CTA every step change.
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [idx, open]);

  // Keyboard: ESC skips, Arrows navigate steps, Tab is trapped inside dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); skipForNow(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); setIdx((i) => Math.min(steps.length - 1, i + 1)); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  function skipForNow() {
    try { window.sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
    toast("Tour paused — resume any time from the Tour button in the header.");
  }

  if (!open) return null;
  const s = steps[idx];
  const Icon = s.icon;
  const last = idx === steps.length - 1;
  const progress = ((idx + 1) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-background/70 backdrop-blur-md p-4 animate-rise"
      onClick={(e) => { if (e.target === e.currentTarget) skipForNow(); }}
      role="presentation"
    >
      {/* Sidebar highlight ring (desktop only) */}
      {s.highlight && (
        <div className="hidden lg:block pointer-events-none fixed inset-y-0 left-0 w-64 border-r-2 border-indigo-neon/40 shadow-[inset_0_0_60px_oklch(0.7_0.2_265_/_0.15)]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="civicpulse-onboarding-title"
        aria-describedby="civicpulse-onboarding-body"
        className="relative w-full max-w-lg glass-panel rounded-2xl border border-indigo-neon/30 overflow-hidden"
      >
        {/* Top progress bar */}
        <div className="h-1 w-full bg-surface-2">
          <div
            className="h-full bg-gradient-to-r from-indigo-neon to-teal-neon transition-all duration-300"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>

        <div className="p-6">
          <button
            onClick={skipForNow}
            className="absolute top-4 right-4 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2 transition"
            aria-label="Close walkthrough"
          >
            <X className="h-4 w-4" />
          </button>

          <div className={cn("h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br text-primary-foreground", s.tone)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Step {idx + 1} of {steps.length}</span>
            <span className="text-indigo-neon">· {Math.round(progress)}%</span>
          </div>
          <h2 id="civicpulse-onboarding-title" className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h2>
          <p id="civicpulse-onboarding-body" className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>

          {/* Progress dots */}
          <div className="mt-5 flex gap-1.5" role="tablist" aria-label="Walkthrough steps">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                role="tab"
                aria-selected={i === idx}
                className={cn(
                  "h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-neon/60",
                  i === idx ? "w-8 bg-indigo-neon" : "w-1.5 bg-surface-3 hover:bg-surface-2"
                )}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 flex-wrap">
            <button
              onClick={skipForNow}
              className="text-[11px] text-muted-foreground hover:text-foreground mr-auto underline-offset-2 hover:underline"
            >
              Skip for now
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
                ref={primaryRef}
                onClick={finish}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground hover:brightness-110 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-neon/60"
              >
                Start using CivicPulse <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <button
                ref={primaryRef}
                onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground hover:brightness-110 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-neon/60"
              >
                Next <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
