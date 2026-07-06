import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { aqiTrend, trafficLoad, resourceMix, forecastSeries } from "@/lib/pulse-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine, ReferenceDot } from "recharts";
import { TrendingUp, Layers, Sparkles, Cpu, ArrowLeft, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Data Analytics · CivicPulse" }, { name: "description", content: "Cross-sector trends, forecasts, and resource allocation intelligence." }] }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["var(--indigo-neon)", "var(--teal-neon)", "var(--emerald-neon)", "var(--amber-neon)", "var(--rose-neon)"];
const tooltipStyle = { background: "oklch(0.22 0.025 260)", border: "1px solid oklch(0.35 0.04 262)", borderRadius: 8, fontSize: 12 };

// -------- KPI drill-down data --------

type KpiKey = "signals" | "models" | "layers" | "forecast";

type SectorRow = { sector: string; value: number; delta: number };
type Anomaly = { at: string; label: string; severity: "high" | "medium" | "low" };
type DrillPayload = {
  title: string;
  unit: string;
  color: string;
  trend: Array<{ t: string; value: number; forecast?: number }>;
  sectors: SectorRow[];
  anomalies: Anomaly[];
  summary: string;
};

const kpis: Array<{ key: KpiKey; label: string; value: string; sub: string; icon: typeof Cpu; tone: string }> = [
  { key: "signals",  label: "Signals / min",     value: "12.4k", sub: "+8.2% WoW",     icon: Cpu,        tone: "text-indigo-neon" },
  { key: "models",   label: "Models in prod",    value: "17",    sub: "3 shadow tests", icon: Sparkles,   tone: "text-teal-neon" },
  { key: "layers",   label: "Data layers",       value: "42",    sub: "9 real-time",   icon: Layers,     tone: "text-emerald-neon" },
  { key: "forecast", label: "Forecast horizon",  value: "72h",   sub: "94% avg conf.", icon: TrendingUp, tone: "text-amber-neon" },
];

const drillData: Record<KpiKey, DrillPayload> = {
  signals: {
    title: "Signals / min — sector breakdown",
    unit: "signals/min",
    color: "var(--indigo-neon)",
    trend: Array.from({ length: 24 }, (_, i) => ({ t: `${i}:00`, value: Math.round(10000 + 2500 * Math.sin(i / 3) + Math.random() * 800) })),
    sectors: [
      { sector: "Sector B",     value: 3120, delta: 18.4 },
      { sector: "Downtown",     value: 2470, delta: 6.2 },
      { sector: "Ward 3",       value: 1980, delta: 12.1 },
      { sector: "Ring Rd E-14", value: 1620, delta: -3.4 },
      { sector: "Ward 7",       value: 1290, delta: 1.8 },
      { sector: "Riverside",    value: 980,  delta: 4.1 },
      { sector: "Ward 8",       value: 940,  delta: -1.1 },
    ],
    anomalies: [
      { at: "07:00", label: "Sector B ingestion +38% (PM2.5 surge)", severity: "high" },
      { at: "14:00", label: "Ring Rd E-14 sensor dropout · 12 min",  severity: "medium" },
      { at: "19:00", label: "Ward 3 EMR burst · pediatric fever cluster", severity: "high" },
    ],
    summary: "Signal volume tracks environmental degradation in Sector B — pipeline healthy, no ingestion loss.",
  },
  models: {
    title: "Models in production — throughput",
    unit: "inferences/min",
    color: "var(--teal-neon)",
    trend: Array.from({ length: 24 }, (_, i) => ({ t: `${i}:00`, value: Math.round(400 + 120 * Math.sin(i / 2.5) + Math.random() * 40) })),
    sectors: [
      { sector: "Respiratory classifier", value: 520, delta: 24.0 },
      { sector: "Traffic forecast",       value: 410, delta: 3.2 },
      { sector: "Sentiment extractor",    value: 360, delta: 8.1 },
      { sector: "Anomaly detector",       value: 290, delta: 12.4 },
      { sector: "Resource optimizer",     value: 180, delta: 1.4 },
      { sector: "Crowd density",          value: 150, delta: 5.6 },
    ],
    anomalies: [
      { at: "05:00", label: "Sentiment extractor drift · retrained overnight", severity: "medium" },
      { at: "12:00", label: "Respiratory classifier confidence dip → auto-recalibrated", severity: "low" },
    ],
    summary: "Model fleet stable. 3 shadow candidates within 2% of prod baselines; promotion review Friday.",
  },
  layers: {
    title: "Data layers — freshness",
    unit: "seconds since update",
    color: "var(--emerald-neon)",
    trend: Array.from({ length: 24 }, (_, i) => ({ t: `${i}:00`, value: Math.round(8 + 4 * Math.sin(i / 3) + Math.random() * 2) })),
    sectors: [
      { sector: "AQI telemetry",    value: 4,   delta: -12.0 },
      { sector: "GTFS-RT transit",  value: 6,   delta: 0.0 },
      { sector: "EMR feed",         value: 12,  delta: 3.0 },
      { sector: "CCTV crowd est.",  value: 18,  delta: -5.0 },
      { sector: "Sanitation IoT",   value: 42,  delta: 18.0 },
      { sector: "Weather composite", value: 60, delta: 0.0 },
    ],
    anomalies: [
      { at: "09:00", label: "Sanitation IoT drift (+18s) — non-critical", severity: "low" },
    ],
    summary: "9 real-time layers within SLA. Sanitation IoT gateway rebooted at 09:12; monitoring recovery.",
  },
  forecast: {
    title: "Forecast horizon — confidence over lead time",
    unit: "% confidence",
    color: "var(--amber-neon)",
    trend: Array.from({ length: 24 }, (_, i) => ({ t: `T+${i * 3}h`, value: Math.round(98 - i * 0.6 - Math.random() * 2), forecast: 90 })),
    sectors: [
      { sector: "Health demand",   value: 96, delta: 1.2 },
      { sector: "Transit flow",    value: 93, delta: -0.4 },
      { sector: "AQI",             value: 91, delta: 0.6 },
      { sector: "Energy load",     value: 89, delta: 2.1 },
      { sector: "Crowd density",   value: 84, delta: -1.8 },
    ],
    anomalies: [
      { at: "T+36h", label: "Health demand exceeds capacity threshold — advisory recommended", severity: "high" },
      { at: "T+48h", label: "Transit forecast confidence dips below 90%", severity: "medium" },
    ],
    summary: "72h horizon holds above 90% aggregate confidence. Sector-level dips concentrated in health & crowd.",
  },
};

function DrillPanel({ payload, onBack }: { payload: DrillPayload; onBack: () => void }) {
  const max = Math.max(...payload.sectors.map((s) => s.value));
  const sevTone: Record<Anomaly["severity"], string> = {
    high: "text-rose-neon border-rose-neon/40 bg-rose-neon/10",
    medium: "text-amber-neon border-amber-neon/40 bg-amber-neon/10",
    low: "text-teal-neon border-teal-neon/40 bg-teal-neon/10",
  };

  // Map anomaly times back to trend points for reference dots
  const anomalyPoints = payload.anomalies
    .map((a) => {
      const point = payload.trend.find((p) => p.t === a.at);
      return point ? { ...point, label: a.label, severity: a.severity } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="glass-panel rounded-2xl p-5 animate-rise">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <button onClick={onBack} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1.5">
            <ArrowLeft className="h-3 w-3" /> Back to KPIs
          </button>
          <div className="text-sm font-semibold">{payload.title}</div>
          <div className="text-[11px] text-muted-foreground">{payload.summary}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-neon/15 text-indigo-neon border border-indigo-neon/30">
          Drill-down · {payload.sectors.length} sectors
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">24h trend · {payload.unit}</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={payload.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="t" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                {payload.trend[0]?.forecast !== undefined && (
                  <ReferenceLine y={payload.trend[0].forecast} stroke="var(--teal-neon)" strokeDasharray="4 4" label={{ value: "SLA", fill: "var(--teal-neon)", fontSize: 10, position: "right" }} />
                )}
                <Line type="monotone" dataKey="value" stroke={payload.color} strokeWidth={2.5} dot={false} />
                {anomalyPoints.map((p, i) => (
                  <ReferenceDot key={i} x={p.t} y={p.value} r={5} fill="var(--rose-neon)" stroke="var(--background)" strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Sector breakdown</div>
          <div className="space-y-2">
            {payload.sectors.map((s) => (
              <div key={s.sector} className="rounded-lg border border-border bg-surface-1/60 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{s.sector}</span>
                  <span className={cn("text-[10px] font-semibold", s.delta >= 0 ? "text-emerald-neon" : "text-rose-neon")}>
                    {s.delta >= 0 ? "+" : ""}{s.delta.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(s.value / max) * 100}%`, background: payload.color }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{payload.unit}</span>
                  <span className="font-mono">{s.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-rose-neon" /> Detected anomalies
        </div>
        <div className="flex flex-wrap gap-2">
          {payload.anomalies.map((a, i) => (
            <div key={i} className={cn("text-[11px] px-3 py-1.5 rounded-lg border inline-flex items-center gap-2", sevTone[a.severity])}>
              <span className="font-mono text-[10px] opacity-80">{a.at}</span>
              <span>{a.label}</span>
            </div>
          ))}
          {payload.anomalies.length === 0 && (
            <div className="text-[11px] text-muted-foreground">No anomalies detected in the last 24h.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const [drill, setDrill] = useState<KpiKey | null>(null);

  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const active = drill === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setDrill(active ? null : k.key)}
              className={cn(
                "glass-panel rounded-2xl p-5 text-left transition group hover:-translate-y-0.5",
                active && "neon-ring-indigo"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
                <k.icon className={`h-4 w-4 ${k.tone} transition group-hover:scale-110`} />
              </div>
              <div className="mt-2 text-2xl font-semibold">{k.value}</div>
              <div className="text-[11px] text-muted-foreground">{k.sub}</div>
              <div className="mt-2 text-[10px] text-indigo-neon opacity-0 group-hover:opacity-100 transition">
                {active ? "Hide drill-down ↑" : "Click to drill down →"}
              </div>
            </button>
          );
        })}
      </div>

      {drill && (
        <div className="mt-4">
          <DrillPanel payload={drillData[drill]} onBack={() => setDrill(null)} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5 xl:col-span-2">
          <div className="mb-2">
            <div className="text-sm font-semibold">Demand vs. Capacity · 48h Forecast</div>
            <div className="text-[11px] text-muted-foreground">Gemini forecaster · 94% confidence band</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={forecastSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="t" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={80} stroke="var(--rose-neon)" strokeDasharray="4 4" label={{ value: "Capacity", fill: "var(--rose-neon)", fontSize: 10, position: "right" }} />
                <Line type="monotone" dataKey="demand" stroke="var(--teal-neon)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="forecast" stroke="var(--indigo-neon)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-2">
            <div className="text-sm font-semibold">Resource Allocation Mix</div>
            <div className="text-[11px] text-muted-foreground">Live budget deployment</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={resourceMix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2} stroke="oklch(0.22 0.025 260)">
                  {resourceMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-2">
            <div className="text-sm font-semibold">Air Quality Trajectory</div>
            <div className="text-[11px] text-muted-foreground">AQI vs PM2.5, hourly</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={aqiTrend}>
                <defs>
                  <linearGradient id="a1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--teal-neon)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="var(--teal-neon)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="hour" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="aqi" stroke="var(--teal-neon)" fill="url(#a1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <div className="mb-2">
            <div className="text-sm font-semibold">Traffic Congestion & Incidents</div>
            <div className="text-[11px] text-muted-foreground">Rolling 24h · 2h bins</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={trafficLoad}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                <XAxis dataKey="window" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="congestion" fill="var(--indigo-neon)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="incidents" fill="var(--amber-neon)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
