import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { aqiTrend, trafficLoad, resourceMix, forecastSeries } from "@/lib/pulse-data";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine } from "recharts";
import { TrendingUp, Layers, Sparkles, Cpu } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Data Analytics · Pulse" }, { name: "description", content: "Cross-sector trends, forecasts, and resource allocation intelligence." }] }),
  component: AnalyticsPage,
});

const PIE_COLORS = ["var(--indigo-neon)", "var(--teal-neon)", "var(--emerald-neon)", "var(--amber-neon)", "var(--rose-neon)"];
const tooltipStyle = { background: "oklch(0.22 0.025 260)", border: "1px solid oklch(0.35 0.04 262)", borderRadius: 8, fontSize: 12 };

function AnalyticsPage() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { l: "Signals / min", v: "12.4k", sub: "+8.2% WoW", icon: Cpu, tone: "text-indigo-neon" },
          { l: "Models in prod", v: "17", sub: "3 shadow tests", icon: Sparkles, tone: "text-teal-neon" },
          { l: "Data layers", v: "42", sub: "9 real-time", icon: Layers, tone: "text-emerald-neon" },
          { l: "Forecast horizon", v: "72h", sub: "94% avg conf.", icon: TrendingUp, tone: "text-amber-neon" },
        ].map((k) => (
          <div key={k.l} className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{k.l}</div>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold">{k.v}</div>
            <div className="text-[11px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

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
