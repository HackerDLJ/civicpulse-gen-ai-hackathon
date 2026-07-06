import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, aqiTrend, store, type StreamEvent, type Alert, type Feedback } from "@/lib/pulse-data";
import { useFirestoreAlerts, useFirestoreFeedback } from "@/lib/firestore-hooks";
import { Activity, Wind, Gauge, Smile, TrendingUp, TrendingDown, MapPin, Zap, Radio, X, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KpiCardSkeleton, MapSkeleton, StreamSkeleton, EmptyState } from "@/components/pulse/Skeletons";
import { CityMap } from "@/components/pulse/CityMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard · CivicPulse" },
      { name: "description", content: "Live KPIs, city map layers, and ingestion stream for municipal operations." },
    ],
  }),
  component: DashboardPage,
});

type KpiKey = "alerts" | "aqi" | "resource" | "satisfaction";

type KpiDef = {
  key: KpiKey;
  label: string;
  value: string;
  delta: string;
  icon: typeof Activity;
  tone: "rose" | "teal" | "indigo" | "emerald";
  trend: number[];
  up: boolean;
};

// KPI definitions are computed live inside DashboardPage from Firestore streams.
// `staticKpis` is only used as a placeholder shape reference for the summary map keys.
type KpiTone = "rose" | "teal" | "indigo" | "emerald";
const KPI_META: Record<KpiKey, { label: string; icon: typeof Activity; tone: KpiTone }> = {
  alerts:       { label: "Active Safety Alerts",    icon: Activity, tone: "rose" },
  aqi:          { label: "Air Quality Index",        icon: Wind,     tone: "teal" },
  resource:     { label: "Resource Allocation Eff.", icon: Gauge,    tone: "indigo" },
  satisfaction: { label: "Citizen Satisfaction",     icon: Smile,    tone: "emerald" },
};

const toneMap = {
  rose: { text: "text-rose-neon", bg: "bg-rose-neon", border: "border-rose-neon/40", soft: "bg-rose-neon/10" },
  teal: { text: "text-teal-neon", bg: "bg-teal-neon", border: "border-teal-neon/40", soft: "bg-teal-neon/10" },
  indigo: { text: "text-indigo-neon", bg: "bg-indigo-neon", border: "border-indigo-neon/40", soft: "bg-indigo-neon/10" },
  emerald: { text: "text-emerald-neon", bg: "bg-emerald-neon", border: "border-emerald-neon/40", soft: "bg-emerald-neon/10" },
};

// -------- 24h summary payloads (Dashboard drill-down) --------

type SectorRow = { sector: string; value: string; delta: number };
type AlertRange = "15m" | "1h" | "6h" | "24h" | "all";
type Anomaly = {
  at: string;
  label: string;
  severity: "high" | "medium" | "low";
  sector?: string;
  range?: AlertRange;
};
type Summary = {
  headline: string;
  narrative: string;
  metrics: Array<{ label: string; value: string }>;
  sectors: SectorRow[];
  anomalies: Anomaly[];
};

const kpiSummary: Record<KpiKey, Summary> = {
  alerts: {
    headline: "14 active alerts · 3 critical demanding operator attention",
    narrative: "Alert volume down 18% vs yesterday. Health & environment dominate the queue — the Sector B respiratory cluster remains the top escalation.",
    metrics: [
      { label: "Automated", value: "6" },
      { label: "Resolved 24h", value: "22" },
      { label: "Median MTTR", value: "38m" },
      { label: "Escalated", value: "3" },
    ],
    sectors: [
      { sector: "Sector B", value: "4 open", delta: 33 },
      { sector: "Ward 3", value: "3 open", delta: 12 },
      { sector: "Ring Rd E-14", value: "2 open", delta: -10 },
      { sector: "Downtown", value: "2 open", delta: 4 },
    ],
    anomalies: [
      { at: "02:12", label: "Sector B respiratory admissions +22% / 6h", severity: "high", sector: "Sector B", range: "6h" },
      { at: "07:48", label: "Ring Rd E-14 cascade risk detected", severity: "medium", sector: "Ring Rd E-14", range: "1h" },
      { at: "14:04", label: "Ward 7 water pressure -0.7 bar drift", severity: "medium", sector: "Ward 7", range: "24h" },
    ],
  },
  aqi: {
    headline: "AQI trending upward — 82 city-wide, 148 at Sector B monitor",
    narrative: "PM2.5 plume trapped under a nocturnal inversion. Industrial belt sensors show 2.1× baseline; downwind wards should expect a lagged spike.",
    metrics: [
      { label: "Peak 24h", value: "148" },
      { label: "Nodes > 100", value: "9 / 214" },
      { label: "PM2.5 avg", value: "42 µg/m³" },
      { label: "Advisory", value: "Draft" },
    ],
    sectors: [
      { sector: "Sector B",  value: "AQI 148", delta: 34 },
      { sector: "Riverside", value: "AQI 121", delta: 22 },
      { sector: "Downtown",  value: "AQI 96",  delta: 11 },
      { sector: "Ward 8",    value: "AQI 68",  delta: -4 },
    ],
    anomalies: [
      { at: "01:20", label: "Inversion layer detected · plume trap forecast 6h", severity: "high", sector: "Sector B", range: "6h" },
      { at: "05:40", label: "Node #142 recalibration · baseline drift corrected", severity: "low" },
      { at: "12:15", label: "Riverside industrial exceedance · 5-node rolling avg", severity: "medium", sector: "Riverside", range: "24h" },
    ],
  },
  resource: {
    headline: "Allocation efficiency 94.2% · headroom skewed to Health & Transit",
    narrative: "Reallocations overnight lifted efficiency 1.8 pts. Sanitation is trailing budget by 3.4% — candidate for redistribution to Health surge tonight.",
    metrics: [
      { label: "Reallocations 24h", value: "17" },
      { label: "Idle capacity", value: "5.8%" },
      { label: "Auto-optimizer", value: "ON" },
      { label: "Forecast conf.", value: "94%" },
    ],
    sectors: [
      { sector: "Health",       value: "98.1%", delta: 2.4 },
      { sector: "Transit",      value: "95.6%", delta: 1.1 },
      { sector: "Safety",       value: "93.2%", delta: 0.6 },
      { sector: "Environment",  value: "91.4%", delta: 3.0 },
      { sector: "Sanitation",   value: "86.8%", delta: -3.4 },
    ],
    anomalies: [
      { at: "T-6h", label: "Auto-shifted 4.2 MW · W7 → W8 substation", severity: "low", sector: "Ward 8", range: "24h" },
      { at: "T-3h", label: "Sanitation route 12 missed · replacement dispatched", severity: "medium", sector: "Downtown", range: "24h" },
    ],
  },
  satisfaction: {
    headline: "Citizen satisfaction 76% · +2.4 pts driven by Transit wins",
    narrative: "Positive signal concentrated in Ward 8 (new bike lanes) and Riverside (pop-up market). Ward 3 remains the drag — healthcare wait times still the top complaint.",
    metrics: [
      { label: "NPS-weighted", value: "76" },
      { label: "Signals 24h", value: "1,204" },
      { label: "Positive share", value: "58%" },
      { label: "Negative share", value: "22%" },
    ],
    sectors: [
      { sector: "Ward 8",     value: "88",  delta: 4.1 },
      { sector: "Ward 2",     value: "85",  delta: 3.2 },
      { sector: "Ward 7",     value: "82",  delta: 1.8 },
      { sector: "Ward 5",     value: "68",  delta: 0.2 },
      { sector: "Ward 3",     value: "62",  delta: -2.6 },
    ],
    anomalies: [
      { at: "08:20", label: "Ward 3 clinic wait complaints spike (+38%)", severity: "high", sector: "Ward 3", range: "24h" },
      { at: "16:05", label: "Riverside market · positive sentiment surge", severity: "low", sector: "Riverside", range: "24h" },
    ],
  },
};

function Sparkline({ data, tone }: { data: number[]; tone: keyof typeof toneMap }) {
  const max = Math.max(...data), min = Math.min(...data);
  const norm = data.map((v) => ((v - min) / Math.max(1, max - min)) * 100);
  const pts = norm.map((v, i) => `${(i / (norm.length - 1)) * 100},${100 - v}`).join(" ");
  const colorVar = { rose: "var(--rose-neon)", teal: "var(--teal-neon)", indigo: "var(--indigo-neon)", emerald: "var(--emerald-neon)" }[tone];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-10 w-full">
      <defs>
        <linearGradient id={`grad-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorVar} stopOpacity="0.5" />
          <stop offset="100%" stopColor={colorVar} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={colorVar} strokeWidth="2" strokeLinecap="round" />
      <polygon points={`0,100 ${pts} 100,100`} fill={`url(#grad-${tone})`} />
    </svg>
  );
}

function KpiCard({ k, active, onClick }: { k: KpiDef; active: boolean; onClick: () => void }) {
  const t = toneMap[k.tone];
  const Trend = k.up ? TrendingUp : TrendingDown;
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass-panel rounded-2xl p-5 relative overflow-hidden text-left transition group hover:-translate-y-0.5",
        active && "neon-ring-indigo ring-1 ring-indigo-neon/40"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{k.value}</div>
        </div>
        <div className={cn("h-9 w-9 grid place-items-center rounded-xl bg-surface-2 transition group-hover:scale-110", t.text)}>
          <k.icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <Trend className={cn("h-3.5 w-3.5", k.up ? "text-emerald-neon" : "text-rose-neon")} />
        <span className={k.up ? "text-emerald-neon" : "text-rose-neon"}>{k.delta}</span>
        <span className="text-muted-foreground">last 24h</span>
      </div>
      <div className="mt-2 -mx-1">
        <Sparkline data={k.trend} tone={k.tone} />
      </div>
      <div className="mt-2 text-[10px] text-indigo-neon opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
        {active ? "Hide 24h summary ↑" : <>Open 24h summary <ArrowUpRight className="h-3 w-3" /></>}
      </div>
    </button>
  );
}

function KpiSummaryPanel({ k, onClose }: { k: KpiDef; onClose: () => void }) {
  const s = kpiSummary[k.key];
  const t = toneMap[k.tone];
  const sevTone: Record<Anomaly["severity"], string> = {
    high: "text-rose-neon border-rose-neon/40 bg-rose-neon/10",
    medium: "text-amber-neon border-amber-neon/40 bg-amber-neon/10",
    low: "text-teal-neon border-teal-neon/40 bg-teal-neon/10",
  };
  const maxAbs = Math.max(...s.sectors.map((r) => Math.abs(r.delta))) || 1;

  return (
    <div className="glass-panel rounded-2xl p-5 animate-rise mt-4 relative overflow-hidden">
      <div className={cn("absolute left-0 top-0 h-full w-1", t.bg)} />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <k.icon className={cn("h-3 w-3", t.text)} /> {k.label} · 24h summary
          </div>
          <div className="mt-1 text-base font-semibold tracking-tight">{s.headline}</div>
          <div className="mt-1 text-xs text-muted-foreground max-w-3xl leading-relaxed">{s.narrative}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Close summary">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {s.metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
            <div className={cn("mt-0.5 text-lg font-semibold", t.text)}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Top sectors</div>
          <div className="space-y-2">
            {s.sectors.map((r) => (
              <div key={r.sector} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{r.sector}</span>
                  <span className={cn("font-mono text-[11px]", t.text)}>{r.value}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", r.delta >= 0 ? t.bg : "bg-rose-neon")}
                      style={{ width: `${(Math.abs(r.delta) / maxAbs) * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-semibold w-12 text-right", r.delta >= 0 ? "text-emerald-neon" : "text-rose-neon")}>
                    {r.delta >= 0 ? "+" : ""}{r.delta}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-rose-neon" /> Notable anomalies
          </div>
          <div className="space-y-2">
            {s.anomalies.map((a, i) => {
              const body = (
                <>
                  <span className="font-mono text-[10px] opacity-80 shrink-0">{a.at}</span>
                  <span className="leading-snug flex-1">{a.label}</span>
                  {a.sector && (
                    <span className="ml-auto text-[10px] font-semibold opacity-80 inline-flex items-center gap-1 shrink-0">
                      Open in Alerts <ArrowUpRight className="h-3 w-3" />
                    </span>
                  )}
                </>
              );
              const className = cn(
                "rounded-lg border px-3 py-2 text-xs flex items-center gap-2 transition",
                sevTone[a.severity],
                a.sector && "hover:brightness-125 hover:-translate-y-0.5 cursor-pointer"
              );
              return a.sector ? (
                <Link
                  key={i}
                  to="/alerts"
                  search={{ sector: a.sector, range: a.range ?? "24h" }}
                  className={className}
                  title={`Filter Live Alerts to ${a.sector} · ${a.range ?? "24h"}`}
                >
                  {body}
                </Link>
              ) : (
                <div key={i} className={className}>{body}</div>
              );
            })}
            {s.anomalies.length === 0 && (
              <div className="text-[11px] text-muted-foreground">No anomalies detected in the last 24h.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// City map moved to a dedicated OpenStreetMap-backed component.
// See src/components/pulse/CityMap.tsx for the layered marker + detail-panel implementation.


// ---------------- STREAM FEED ----------------

const toneColor: Record<StreamEvent["tone"], string> = {
  indigo: "text-indigo-neon", teal: "text-teal-neon", emerald: "text-emerald-neon", amber: "text-amber-neon", rose: "text-rose-neon",
};

function StreamFeed() {
  const stream = useStore((s) => s.stream);

  useEffect(() => {
    const messages: Array<Omit<StreamEvent, "id" | "ts">> = [
      { channel: "Ingestion", message: "Gemini classified 18 new citizen reports (94% conf.)", tone: "indigo" },
      { channel: "Sensor Grid", message: "AQI node #142 recalibrated · baseline drift corrected", tone: "teal" },
      { channel: "Transit", message: "Bus corridor B7 rerouted — ETA impact -6 min", tone: "emerald" },
      { channel: "Health", message: "EMR stream: 3 new respiratory cases · Sector B", tone: "amber" },
      { channel: "Safety", message: "Crowd density model updated · Plaza 7.4k → 8.1k", tone: "rose" },
      { channel: "Ingestion", message: "MOCK API Ingestion: 27 unstructured forum posts vectorized", tone: "indigo" },
    ];
    const id = setInterval(() => {
      const m = messages[Math.floor(Math.random() * messages.length)];
      store.pushStream(m);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-panel rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-teal-neon" />
            Ingested Data Streams
          </div>
          <div className="text-[11px] text-muted-foreground">Raw sources · normalized in real time</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-neon/15 text-emerald-neon border border-emerald-neon/30 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" /> LIVE
        </span>
      </div>
      <div className="mt-4 flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto pr-1 space-y-2">
          {stream.length === 0 ? (
            <EmptyState
              title="Stream is quiet"
              hint="No ingestion events in the last few seconds. Reconnect to force a resync with the 42 upstream layers."
              icon={<Radio className="h-5 w-5" />}
              actionLabel="Reconnect stream"
              onAction={() => {
                store.pushStream({ channel: "Ingestion", message: "Manual reconnect · re-subscribed to 42 upstream layers", tone: "indigo" });
                toast.success("Stream reconnected", { description: "42 upstream layers re-subscribed." });
              }}
            />
          ) : (
            stream.map((s) => (
              <div key={s.id} className="animate-rise rounded-lg bg-surface-1/70 border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className={cn("font-medium", toneColor[s.tone])}>{s.channel}</span>
                  <span>{s.ts}</span>
                </div>
                <div className="mt-1 text-xs leading-snug">{s.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * useRollingSeries — captures a value over time (every `intervalMs`) so KPI
 * sparklines have a real live trend even when Firestore returns a single
 * snapshot. Kept in-memory per session.
 */
function useRollingSeries(value: number, size = 7, intervalMs = 6000): number[] {
  const [series, setSeries] = useState<number[]>(() => Array.from({ length: size }, () => value));
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => [...prev.slice(1), latest.current]);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  // Keep the last slot in sync with the live value so the trailing point tracks the current snapshot.
  return useMemo(() => [...series.slice(0, -1), value], [series, value]);
}

/** Derive the four dashboard KPIs from the live Firestore alerts + feedback snapshots. */
function computeLiveKpis(alerts: Alert[], feedback: Feedback[]) {
  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const handled = alerts.filter((a) => a.status === "resolved" || a.status === "automated").length;
  const resourceEff = alerts.length > 0 ? (handled / alerts.length) * 100 : 0;

  const positives = feedback.filter((f) => f.sentiment === "Positive").length;
  const negatives = feedback.filter((f) => f.sentiment === "Negative").length;
  const scored = positives + negatives + feedback.filter((f) => f.sentiment === "Neutral").length;
  // Weighted satisfaction: positives full credit, neutrals half, negatives zero.
  const satisfaction = scored > 0
    ? ((positives + (scored - positives - negatives) * 0.5) / scored) * 100
    : 0;

  // AQI is not sourced from Firestore — hold a derived proxy from environment alerts
  // so the tile still reacts to live data (each env alert nudges the index up).
  const envAlerts = alerts.filter((a) => a.category === "environment" && a.status !== "resolved").length;
  const aqi = Math.min(180, 62 + envAlerts * 9);

  return { openAlerts, resourceEff, satisfaction, aqi };
}

function DashboardPage() {
  const [drill, setDrill] = useState<KpiKey | null>(null);
  const { data: alertsData, loading: aLoading, error: aError } = useFirestoreAlerts();
  const { data: feedbackData, loading: fLoading } = useFirestoreFeedback();
  const alerts = alertsData ?? [];
  const feedback = feedbackData ?? [];

  const { openAlerts, resourceEff, satisfaction, aqi } = useMemo(
    () => computeLiveKpis(alerts, feedback),
    [alerts, feedback],
  );

  // Live rolling sparkline buffers (updated every 6s from the current snapshot).
  const alertsTrend = useRollingSeries(openAlerts);
  const aqiTrendMini = useRollingSeries(aqi);
  const resourceTrend = useRollingSeries(Math.round(resourceEff * 10) / 10);
  const satisfactionTrend = useRollingSeries(Math.round(satisfaction * 10) / 10);

  const delta = (series: number[]) => {
    if (series.length < 2) return 0;
    return series[series.length - 1] - series[0];
  };

  const liveKpis: KpiDef[] = useMemo(() => {
    const d1 = delta(alertsTrend);
    const d2 = delta(aqiTrendMini);
    const d3 = delta(resourceTrend);
    const d4 = delta(satisfactionTrend);
    return [
      { key: "alerts",       ...KPI_META.alerts,       value: String(openAlerts),                delta: `${d1 >= 0 ? "+" : ""}${d1} vs open`,    trend: alertsTrend,       up: d1 <= 0 },
      { key: "aqi",          ...KPI_META.aqi,          value: String(aqi),                       delta: `${d2 >= 0 ? "+" : ""}${d2} pts`,        trend: aqiTrendMini,      up: d2 <= 0 },
      { key: "resource",     ...KPI_META.resource,     value: `${resourceEff.toFixed(1)}%`,      delta: `${d3 >= 0 ? "+" : ""}${d3.toFixed(1)}%`, trend: resourceTrend,     up: d3 >= 0 },
      { key: "satisfaction", ...KPI_META.satisfaction, value: `${Math.round(satisfaction)}%`,    delta: `${d4 >= 0 ? "+" : ""}${d4.toFixed(1)}%`, trend: satisfactionTrend, up: d4 >= 0 },
    ];
  }, [openAlerts, aqi, resourceEff, satisfaction, alertsTrend, aqiTrendMini, resourceTrend, satisfactionTrend]);

  const activeKpi = liveKpis.find((k) => k.key === drill) ?? null;

  // Live ward satisfaction derived from Firestore feedback snapshot.
  const liveWardSatisfaction = useMemo(() => {
    const groups = new Map<string, { pos: number; neu: number; neg: number }>();
    for (const f of feedback) {
      const ward = f.ward || "—";
      const cur = groups.get(ward) ?? { pos: 0, neu: 0, neg: 0 };
      if (f.sentiment === "Positive") cur.pos++;
      else if (f.sentiment === "Negative") cur.neg++;
      else cur.neu++;
      groups.set(ward, cur);
    }
    return Array.from(groups.entries())
      .map(([ward, g]) => {
        const total = g.pos + g.neu + g.neg;
        const score = total > 0 ? Math.round(((g.pos + g.neu * 0.5) / total) * 100) : 0;
        return { ward, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [feedback]);

  const loading = aLoading || fLoading;

  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : liveKpis.map((k) => (
              <KpiCard
                key={k.key}
                k={k}
                active={drill === k.key}
                onClick={() => setDrill(drill === k.key ? null : k.key)}
              />
            ))}
      </div>

      {aError && (
        <div className="mt-3 text-[11px] text-rose-neon/90 glass-panel rounded-lg px-3 py-2 border border-rose-neon/30">
          Firestore alerts stream error — KPI values reflect last-known snapshot. ({aError})
        </div>
      )}

      {activeKpi && <KpiSummaryPanel k={activeKpi} onClose={() => setDrill(null)} />}

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-neon" /> Fused City Signal Map</div>
              <div className="text-[11px] text-muted-foreground">Traffic congestion · Environmental risk · Healthcare access</div>
            </div>
          </div>
          {loading ? <MapSkeleton /> : <CityMap />}
        </div>
        {loading ? <StreamSkeleton /> : <StreamFeed />}
      </div>


      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold">AQI & PM2.5 · Last 24h</div>
              <div className="text-[11px] text-muted-foreground">Aggregated across 214 sensor nodes</div>
            </div>
            <div className="text-[11px] flex gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-neon" />AQI</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-neon" />PM2.5</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={aqiTrend}>
                <defs>
                  <linearGradient id="aqiG" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--teal-neon)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="var(--teal-neon)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="pmG" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--amber-neon)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--amber-neon)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="hour" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.025 260)", border: "1px solid oklch(0.35 0.04 262)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="aqi" stroke="var(--teal-neon)" strokeWidth={2} fill="url(#aqiG)" />
                <Area type="monotone" dataKey="pm25" stroke="var(--amber-neon)" strokeWidth={2} fill="url(#pmG)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-neon" /> Citizen Satisfaction · by Ward</div>
              <div className="text-[11px] text-muted-foreground">NPS-weighted, rolling 7d</div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={wardSatisfaction}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="ward" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.025 260)", border: "1px solid oklch(0.35 0.04 262)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" fill="var(--indigo-neon)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
