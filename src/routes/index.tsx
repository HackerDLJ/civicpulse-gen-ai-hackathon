import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, aqiTrend, wardSatisfaction, store, type StreamEvent } from "@/lib/pulse-data";
import { Activity, Wind, Gauge, Smile, TrendingUp, TrendingDown, MapPin, Layers, Zap, Radio, Car, HeartPulse, X, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KpiCardSkeleton, MapSkeleton, StreamSkeleton, EmptyState } from "@/components/pulse/Skeletons";

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

const kpis: KpiDef[] = [
  { key: "alerts",       label: "Active Safety Alerts",     value: "14",    delta: "-3 vs 24h", icon: Activity, tone: "rose",    trend: [12, 15, 18, 14, 17, 14, 14], up: false },
  { key: "aqi",          label: "Air Quality Index",         value: "82",    delta: "+6 pts",    icon: Wind,     tone: "teal",    trend: [70, 72, 74, 78, 80, 79, 82], up: true },
  { key: "resource",     label: "Resource Allocation Eff.",  value: "94.2%", delta: "+1.8%",     icon: Gauge,    tone: "indigo",  trend: [88, 89, 91, 92, 93, 93, 94], up: true },
  { key: "satisfaction", label: "Citizen Satisfaction",      value: "76%",   delta: "+2.4%",     icon: Smile,    tone: "emerald", trend: [70, 71, 73, 72, 74, 75, 76], up: true },
];

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


// ---------------- CITY MAP ----------------

type LayerKey = "traffic" | "environment" | "health";
type Hotspot = {
  id: string;
  x: number;
  y: number;
  r: number;
  layer: LayerKey;
  color: string;
  title: string;
  sector: string;
  metric: string;
  value: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Nominal";
  detail: string;
};

const hotspots: Hotspot[] = [
  { id: "h1", x: 22, y: 34, r: 46, layer: "health", color: "rose",   title: "Respiratory cluster", sector: "Sector B", metric: "Admissions Δ", value: "+22% / 6h", severity: "Critical", detail: "PM2.5 plume trapping under inversion layer. 340 walk-ins projected tonight." },
  { id: "h2", x: 62, y: 22, r: 38, layer: "traffic", color: "amber", title: "Ring Rd E-14 congestion", sector: "Ring Rd E-14", metric: "Flow saturation", value: "92%", severity: "High", detail: "Signal desync + freight overlap. Cascade risk in 40 min." },
  { id: "h3", x: 74, y: 62, r: 30, layer: "environment", color: "teal", title: "Water pressure anomaly", sector: "Ward 7", metric: "Δ baseline", value: "-0.7 bar", severity: "Medium", detail: "Substation drift. No leak signature yet — monitor 2h." },
  { id: "h4", x: 40, y: 70, r: 42, layer: "environment", color: "rose", title: "Heat island", sector: "Downtown", metric: "Surface temp Δ", value: "+2.4°C", severity: "High", detail: "Grid trending above forecast. Cooling center readiness advised." },
  { id: "h5", x: 50, y: 44, r: 26, layer: "traffic", color: "indigo", title: "Crowd density surge", sector: "Central Plaza", metric: "Est. count", value: "8,120", severity: "Medium", detail: "Approaching safety threshold. Deploy stewards within 25 min." },
  { id: "h6", x: 84, y: 40, r: 26, layer: "health", color: "emerald", title: "Riverside · nominal", sector: "Riverside", metric: "Clinic load", value: "48%", severity: "Nominal", detail: "All indicators within baseline. No action required." },
  { id: "h7", x: 30, y: 58, r: 30, layer: "health", color: "amber", title: "Clinic capacity strain", sector: "Ward 3", metric: "Utilization", value: "92%", severity: "High", detail: "Overflow risk within 90 min at current arrival rate." },
  { id: "h8", x: 66, y: 78, r: 24, layer: "traffic", color: "teal",  title: "NR-9 junction spillback", sector: "NR-9 / 4th Ave", metric: "Queue length", value: "310m", severity: "Medium", detail: "Left-turn cascade every ~14 min. Retiming candidate." },
];

const layerMeta: Record<LayerKey, { label: string; icon: typeof Car; tone: string; ring: string }> = {
  traffic:     { label: "Traffic",     icon: Car,        tone: "text-amber-neon",   ring: "border-amber-neon/50 bg-amber-neon/10 text-amber-neon" },
  environment: { label: "Environment", icon: Wind,       tone: "text-teal-neon",    ring: "border-teal-neon/50 bg-teal-neon/10 text-teal-neon" },
  health:      { label: "Health",      icon: HeartPulse, tone: "text-rose-neon",    ring: "border-rose-neon/50 bg-rose-neon/10 text-rose-neon" },
};

const sevTone: Record<Hotspot["severity"], string> = {
  Critical: "text-rose-neon",
  High:     "text-amber-neon",
  Medium:   "text-teal-neon",
  Low:      "text-indigo-neon",
  Nominal:  "text-emerald-neon",
};

function CityMap() {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ traffic: true, environment: true, health: true });
  const [hover, setHover] = useState<Hotspot | null>(null);
  const [pinned, setPinned] = useState<Hotspot | null>(null);
  const colorMap: Record<string, string> = {
    rose: "var(--rose-neon)", amber: "var(--amber-neon)", teal: "var(--teal-neon)", indigo: "var(--indigo-neon)", emerald: "var(--emerald-neon)",
  };
  const visible = hotspots.filter((h) => layers[h.layer]);
  const activeCount = Object.values(layers).filter(Boolean).length;
  const focused = pinned ?? hover;

  return (
    <div>
      {/* Layer toggles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {(Object.keys(layerMeta) as LayerKey[]).map((k) => {
          const m = layerMeta[k];
          const on = layers[k];
          const count = hotspots.filter((h) => h.layer === k).length;
          const Icon = m.icon;
          return (
            <button
              key={k}
              onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-md border transition inline-flex items-center gap-1.5",
                on ? m.ring : "border-border text-muted-foreground hover:text-foreground opacity-60"
              )}
            >
              <Icon className="h-3 w-3" />
              {m.label}
              <span className={cn("text-[10px] px-1 rounded", on ? "bg-background/40" : "bg-surface-2")}>{count}</span>
            </button>
          );
        })}
        <button
          onClick={() => setLayers({ traffic: true, environment: true, health: true })}
          className="text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition"
        >
          Reset
        </button>
      </div>

      <div className="relative aspect-[16/10] w-full rounded-xl border border-border overflow-hidden bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_262)_0%,_oklch(0.18_0.02_260)_70%)]">
        <svg className="absolute inset-0 h-full w-full opacity-40">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.4 0.03 262 / 0.35)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <svg className="absolute inset-0 h-full w-full">
          <path d="M 0 240 Q 200 180 380 260 T 780 220" stroke="oklch(0.55 0.13 200 / 0.5)" strokeWidth="3" fill="none" />
          <path d="M 120 0 L 200 500" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
          <path d="M 500 0 L 620 500" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
          <path d="M 0 120 L 900 180" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
        </svg>

        {visible.map((h) => {
          const active = focused?.id === h.id;
          return (
            <button
              key={h.id}
              onMouseEnter={() => setHover(h)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPinned(pinned?.id === h.id ? null : h)}
              className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
              style={{ left: `${h.x}%`, top: `${h.y}%` }}
            >
              <div
                className={cn("rounded-full transition-transform", active && "scale-125")}
                style={{ width: h.r, height: h.r, background: `radial-gradient(circle, ${colorMap[h.color]}66 0%, ${colorMap[h.color]}00 70%)` }}
              />
              <div className="absolute inset-0 grid place-items-center">
                <span
                  className={cn("h-2.5 w-2.5 rounded-full pulse-dot", active && "h-3.5 w-3.5")}
                  style={{ background: colorMap[h.color], boxShadow: `0 0 14px ${colorMap[h.color]}` }}
                />
              </div>
              {active && (
                <span className="absolute inset-0 -m-1.5 rounded-full border border-dashed" style={{ borderColor: colorMap[h.color] }} />
              )}
            </button>
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-teal-neon/10 to-transparent" style={{ animation: "scan 6s linear infinite" }} />

        <div className="absolute left-3 bottom-3 glass-panel rounded-lg px-3 py-2 text-[10px] flex flex-wrap gap-3">
          {[
            { c: "rose", l: "Critical" },
            { c: "amber", l: "High" },
            { c: "teal", l: "Medium" },
            { c: "indigo", l: "Safety" },
            { c: "emerald", l: "Nominal" },
          ].map((x) => (
            <span key={x.l} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorMap[x.c] }} />
              {x.l}
            </span>
          ))}
        </div>

        <div className="absolute right-3 top-3 glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-teal-neon" /> {activeCount} layer{activeCount === 1 ? "" : "s"} · {visible.length} hotspots
        </div>
        <div className="absolute left-3 top-3 glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-indigo-neon" /> Metropolitan District
        </div>

        {/* Detail panel */}
        {focused && (
          <div className="absolute right-3 bottom-3 w-72 glass-panel rounded-xl p-4 animate-rise">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {(() => { const Icon = layerMeta[focused.layer].icon; return <Icon className={cn("h-3 w-3", layerMeta[focused.layer].tone)} />; })()}
                  {layerMeta[focused.layer].label} · {focused.sector}
                </div>
                <div className="mt-0.5 text-sm font-semibold tracking-tight">{focused.title}</div>
              </div>
              {pinned && (
                <button onClick={() => setPinned(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{focused.metric}</div>
                <div className="text-xl font-semibold">{focused.value}</div>
              </div>
              <div className={cn("ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded border border-current/40 bg-current/10", sevTone[focused.severity])}>
                <span className={sevTone[focused.severity]}>{focused.severity}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground leading-snug">{focused.detail}</div>
            {!pinned && <div className="mt-2 text-[10px] text-muted-foreground/70">Click marker to pin details</div>}
          </div>
        )}
      </div>
    </div>
  );
}

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

function DashboardPage() {
  const [drill, setDrill] = useState<KpiKey | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 650);
    return () => clearTimeout(t);
  }, []);

  const activeKpi = kpis.find((k) => k.key === drill) ?? null;

  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {hydrated
          ? kpis.map((k) => (
              <KpiCard
                key={k.key}
                k={k}
                active={drill === k.key}
                onClick={() => setDrill(drill === k.key ? null : k.key)}
              />
            ))
          : Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>

      {activeKpi && <KpiSummaryPanel k={activeKpi} onClose={() => setDrill(null)} />}

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-neon" /> Fused City Signal Map</div>
              <div className="text-[11px] text-muted-foreground">Traffic congestion · Environmental risk · Healthcare access</div>
            </div>
          </div>
          {hydrated ? <CityMap /> : <MapSkeleton />}
        </div>
        {hydrated ? <StreamFeed /> : <StreamSkeleton />}
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
