import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles,
  ArrowRight, Wind, Gauge, MapPin, Zap, ShieldCheck, Cpu, Waves,
} from "lucide-react";
import logoAsset from "@/assets/civicpulse-logo.svg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicPulse · Real-time City Intelligence" },
      { name: "description", content: "CivicPulse fuses live city telemetry, citizen signal, and Gemini reasoning into decisions municipal operators can act on in seconds." },
      { property: "og:title", content: "CivicPulse · Real-time City Intelligence" },
      { property: "og:description", content: "Live alerts, environment, traffic and community signal — unified in one operations console." },
    ],
  }),
  component: HeroPage,
});

const pillars = [
  { icon: AlertTriangle, tone: "rose",    title: "Live Alerts",       body: "Health, environment, traffic, safety and utility anomalies streamed the moment they cross threshold." },
  { icon: BarChart3,     tone: "indigo",  title: "Deep Analytics",    body: "Forecasts, cross-sector correlations and ward-level rankings powered by the same live feeds." },
  { icon: MessageSquareText, tone: "teal", title: "Community Signal", body: "Citizen feedback + Google Maps community reviews, sentiment-scored and mapped to wards." },
  { icon: Sparkles,      tone: "emerald", title: "AI Assistant",      body: "Ask anything — a Gemini-powered operator that reasons over your live city state." },
];

const streams = [
  { icon: Wind,     label: "Air Quality",   src: "Google Air Quality API" },
  { icon: Waves,    label: "Weather",       src: "Google Weather" },
  { icon: Gauge,    label: "Pollen",        src: "Google Pollen" },
  { icon: Zap,      label: "Traffic",       src: "Google Roads · Places" },
  { icon: MapPin,   label: "Community",     src: "Google Places Reviews" },
  { icon: ShieldCheck, label: "Safety",     src: "Municipal telemetry" },
];

const toneMap: Record<string, { text: string; ring: string; soft: string }> = {
  rose:    { text: "text-rose-neon",    ring: "ring-rose-neon/30",    soft: "bg-rose-neon/10" },
  indigo:  { text: "text-indigo-neon",  ring: "ring-indigo-neon/30",  soft: "bg-indigo-neon/10" },
  teal:    { text: "text-teal-neon",    ring: "ring-teal-neon/30",    soft: "bg-teal-neon/10" },
  emerald: { text: "text-emerald-neon", ring: "ring-emerald-neon/30", soft: "bg-emerald-neon/10" },
};

function HeroPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-indigo-neon/20 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-teal-neon/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-neon/10 blur-[140px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:52px_52px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon shrink-0">
            <img src={logoAsset.url} alt="" className="h-5 w-5 [filter:brightness(0)_invert(1)]" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">CivicPulse</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">City Intelligence</div>
          </div>
          <div className="flex-1" />
          <Link to="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
            Skip intro <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground text-xs font-medium shadow-lg shadow-indigo-neon/20 hover:brightness-110 transition"
          >
            Enter console <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/60 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" />
            Live · fused telemetry + citizen signal
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
            Run your city
            <span className="block bg-gradient-to-r from-indigo-neon via-teal-neon to-emerald-neon bg-clip-text text-transparent">
              in real time.
            </span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            CivicPulse unifies live air, weather, traffic, safety and citizen feedback into one operator console —
            with a Gemini-powered assistant that turns raw signal into decisions in seconds.
          </p>

          {/* Inline feature highlights */}
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl text-[12.5px]">
            {[
              { icon: AlertTriangle, tone: "text-rose-neon",    label: "Live anomaly alerts across every ward" },
              { icon: BarChart3,     tone: "text-indigo-neon",  label: "Forecasts and cross-sector correlations" },
              { icon: Sparkles,      tone: "text-emerald-neon", label: "Ask the AI. Get an operator-grade answer." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface-1/40 px-3 py-2">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${f.tone}`} />
                  <span className="text-foreground/85 leading-snug">{f.label}</span>
                </li>
              );
            })}
          </ul>

          {/* Primary + secondary CTA */}
          <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              to="/dashboard"
              className="group relative inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-indigo-neon via-primary to-teal-neon text-primary-foreground text-sm font-semibold tracking-tight shadow-[0_10px_40px_-10px_oklch(0.74_0.16_268/0.55)] hover:brightness-110 hover:shadow-[0_16px_50px_-10px_oklch(0.74_0.16_268/0.7)] transition-all"
            >
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />
              Open the operations console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/alerts"
              className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border border-border bg-surface-1/60 hover:bg-surface-2 hover:border-rose-neon/40 text-sm text-foreground transition"
            >
              <AlertTriangle className="h-4 w-4 text-rose-neon" /> See live alerts
            </Link>
            <span className="text-[11px] text-muted-foreground sm:pl-1">No signup · instant demo data</span>
          </div>

          {/* Stat strip */}
          <dl className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { k: "214", l: "Sensor nodes" },
              { k: "6",   l: "Live signal streams" },
              { k: "<2s", l: "Alert propagation" },
              { k: "24/7", l: "Gemini reasoning" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-surface-1/50 backdrop-blur px-4 py-3">
                <dt className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{s.l}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-gradient-brand">{s.k}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">What's inside</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">Four surfaces, one live model of your city.</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((p) => {
            const t = toneMap[p.tone];
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={`group relative rounded-2xl border border-border bg-surface-1/50 backdrop-blur p-6 hover:bg-surface-2/60 transition overflow-hidden`}
              >
                <div className={`absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-40 ${t.soft}`} />
                <div className={`inline-grid h-11 w-11 place-items-center rounded-xl ${t.soft} ring-1 ${t.ring}`}>
                  <Icon className={`h-5 w-5 ${t.text}`} />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Streams */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="rounded-2xl border border-border bg-surface-1/40 backdrop-blur p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Cpu className="h-3.5 w-3.5" /> Live signal streams
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Everything wired to a single ward map.</h2>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {streams.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-border bg-background/40 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-teal-neon" />
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-widest text-muted-foreground">{s.src}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-indigo-neon/15 via-surface-1/40 to-teal-neon/15 p-8 sm:p-12">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-neon/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-teal-neon/20 blur-3xl" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Ready to run your city live?</h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Open the operations dashboard — every widget is already streaming.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground text-sm font-medium shadow-xl shadow-indigo-neon/25 hover:brightness-110 transition"
              >
                Enter console <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/assistant"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-border bg-surface-1/60 hover:bg-surface-2 text-sm text-foreground transition"
              >
                <Sparkles className="h-4 w-4 text-emerald-neon" /> Try the AI assistant
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} CivicPulse · City Intelligence</div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link to="/alerts" className="hover:text-foreground">Alerts</Link>
            <Link to="/analytics" className="hover:text-foreground">Analytics</Link>
            <Link to="/feedback" className="hover:text-foreground">Feedback</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
