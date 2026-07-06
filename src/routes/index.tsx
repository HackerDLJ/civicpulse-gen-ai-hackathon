import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, aqiTrend, wardSatisfaction, store, type StreamEvent } from "@/lib/pulse-data";
import { Activity, Wind, Gauge, Smile, TrendingUp, TrendingDown, MapPin, Layers, Zap, Radio } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect } from "react";
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
  rose: { text: "text-rose-neon", ring: "neon-ring-indigo", bar: "bg-rose-neon" },
  teal: { text: "text-teal-neon", ring: "neon-ring-teal", bar: "bg-teal-neon" },
  indigo: { text: "text-indigo-neon", ring: "neon-ring-indigo", bar: "bg-indigo-neon" },
  emerald: { text: "text-emerald-neon", ring: "neon-ring-emerald", bar: "bg-emerald-neon" },
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

// Stylized map with layered hotspots
function CityMap() {
  const hotspots = [
    { x: 22, y: 34, r: 44, color: "rose", label: "Sector B · respiratory cluster" },
    { x: 62, y: 22, r: 36, color: "amber", label: "Ring Rd E-14 · congestion" },
    { x: 74, y: 62, r: 30, color: "teal", label: "Ward 7 · water pressure" },
    { x: 40, y: 70, r: 40, color: "rose", label: "Downtown · heat island" },
    { x: 50, y: 44, r: 24, color: "indigo", label: "Central Plaza · crowd" },
    { x: 84, y: 40, r: 26, color: "emerald", label: "Riverside · normal" },
  ];
  const colorMap: Record<string, string> = {
    rose: "var(--rose-neon)", amber: "var(--amber-neon)", teal: "var(--teal-neon)", indigo: "var(--indigo-neon)", emerald: "var(--emerald-neon)",
  };

  return (
    <div className="relative aspect-[16/10] w-full rounded-xl border border-border overflow-hidden bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_262)_0%,_oklch(0.18_0.02_260)_70%)]">
      {/* Grid */}
      <svg className="absolute inset-0 h-full w-full opacity-40">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.4 0.03 262 / 0.35)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Rivers/roads */}
      <svg className="absolute inset-0 h-full w-full">
        <path d="M 0 240 Q 200 180 380 260 T 780 220" stroke="oklch(0.55 0.13 200 / 0.5)" strokeWidth="3" fill="none" />
        <path d="M 120 0 L 200 500" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
        <path d="M 500 0 L 620 500" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
        <path d="M 0 120 L 900 180" stroke="oklch(0.65 0.05 262 / 0.5)" strokeWidth="1.5" fill="none" />
      </svg>

      {/* Hotspots */}
      {hotspots.map((h, i) => (
        <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
          <div className="rounded-full" style={{ width: h.r, height: h.r, background: `radial-gradient(circle, ${colorMap[h.color]}55 0%, ${colorMap[h.color]}00 70%)` }} />
          <div className="absolute inset-0 grid place-items-center">
            <span className="h-2 w-2 rounded-full pulse-dot" style={{ background: colorMap[h.color], boxShadow: `0 0 12px ${colorMap[h.color]}` }} />
          </div>
          <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover/95 border border-border px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition pointer-events-none">
            {h.label}
          </div>
        </div>
      ))}

      {/* Scan line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-teal-neon/10 to-transparent" style={{ animation: "scan 6s linear infinite" }} />

      {/* Legend */}
      <div className="absolute left-3 bottom-3 glass-panel rounded-lg px-3 py-2 text-[10px] flex flex-wrap gap-3">
        {[
          { c: "rose", l: "Env. risk" },
          { c: "amber", l: "Traffic" },
          { c: "teal", l: "Utilities" },
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
        <Layers className="h-3 w-3 text-teal-neon" /> 3 layers active
      </div>
      <div className="absolute left-3 top-3 glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-indigo-neon" /> Metropolitan District
      </div>
    </div>
  );
}

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
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-neon" /> Fused City Signal Map</div>
              <div className="text-[11px] text-muted-foreground">Traffic · Environmental risk · Healthcare access</div>
            </div>
            <div className="hidden sm:flex gap-1.5 text-[10px]">
              {["Traffic", "Environment", "Health"].map((t, i) => (
                <button key={t} className={cn("px-2.5 py-1 rounded-md border transition", i === 0 ? "border-indigo-neon/50 text-indigo-neon bg-indigo-neon/10" : "border-border text-muted-foreground hover:text-foreground")}>{t}</button>
              ))}
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
