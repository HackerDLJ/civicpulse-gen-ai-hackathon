import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, aqiTrend, wardSatisfaction, store, type StreamEvent } from "@/lib/pulse-data";
import { Activity, Wind, Gauge, Smile, TrendingUp, TrendingDown, MapPin, Layers, Zap, Radio, Car, HeartPulse, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard · Pulse" },
      { name: "description", content: "Live KPIs, city map layers, and ingestion stream for municipal operations." },
    ],
  }),
  component: DashboardPage,
});

const kpis = [
  { label: "Active Safety Alerts", value: "14", delta: "-3 vs 24h", icon: Activity, tone: "rose" as const, trend: [12, 15, 18, 14, 17, 14, 14], up: false },
  { label: "Air Quality Index", value: "82", delta: "+6 pts", icon: Wind, tone: "teal" as const, trend: [70, 72, 74, 78, 80, 79, 82], up: true },
  { label: "Resource Allocation Eff.", value: "94.2%", delta: "+1.8%", icon: Gauge, tone: "indigo" as const, trend: [88, 89, 91, 92, 93, 93, 94], up: true },
  { label: "Citizen Satisfaction", value: "76%", delta: "+2.4%", icon: Smile, tone: "emerald" as const, trend: [70, 71, 73, 72, 74, 75, 76], up: true },
];

const toneMap = {
  rose: { text: "text-rose-neon" },
  teal: { text: "text-teal-neon" },
  indigo: { text: "text-indigo-neon" },
  emerald: { text: "text-emerald-neon" },
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

function KpiCard({ k }: { k: typeof kpis[number] }) {
  const t = toneMap[k.tone];
  const Trend = k.up ? TrendingUp : TrendingDown;
  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{k.value}</div>
        </div>
        <div className={cn("h-9 w-9 grid place-items-center rounded-xl bg-surface-2", t.text)}>
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
          {stream.map((s) => (
            <div key={s.id} className="animate-rise rounded-lg bg-surface-1/70 border border-border/60 px-3 py-2">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className={cn("font-medium", toneColor[s.tone])}>{s.channel}</span>
                <span>{s.ts}</span>
              </div>
              <div className="mt-1 text-xs leading-snug">{s.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} k={k} />)}
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-neon" /> Fused City Signal Map</div>
              <div className="text-[11px] text-muted-foreground">Traffic congestion · Environmental risk · Healthcare access</div>
            </div>
          </div>
          <CityMap />
        </div>
        <StreamFeed />
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
