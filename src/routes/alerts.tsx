import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { type Alert } from "@/lib/pulse-data";
import { useFirestoreAlerts, updateAlertStatus } from "@/lib/firestore-hooks";
import { useLiveHotspots, deriveGoogleAlerts } from "@/lib/live-hotspots";
import type { WardMetrics } from "@/lib/google-maps.functions";
import {
  AlertTriangle, Zap, Check, Filter, ShieldAlert, Activity, Droplet, Car, Wind,
  RotateCcw, ChevronDown, Radio, X, Wind as WindIcon, Flower2, Thermometer, TrafficCone, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListSkeleton, ErrorState } from "@/components/pulse/Skeletons";

type AlertsSearch = {
  sector?: string;
  range?: "15m" | "1h" | "6h" | "24h" | "all";
  sev?: string;
  status?: "all" | "open" | "automated" | "resolved";
};

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Live Alerts · CivicPulse" }, { name: "description", content: "AI-flagged anomalies with automated workflow controls." }] }),
  validateSearch: (raw: Record<string, unknown>): AlertsSearch => {
    const ranges: AlertsSearch["range"][] = ["15m", "1h", "6h", "24h", "all"];
    const statuses: AlertsSearch["status"][] = ["all", "open", "automated", "resolved"];
    return {
      sector: typeof raw.sector === "string" ? raw.sector : undefined,
      range: ranges.includes(raw.range as AlertsSearch["range"]) ? (raw.range as AlertsSearch["range"]) : undefined,
      sev: typeof raw.sev === "string" ? raw.sev : undefined,
      status: statuses.includes(raw.status as AlertsSearch["status"]) ? (raw.status as AlertsSearch["status"]) : undefined,
    };
  },
  component: AlertsPage,
});

const sevMap: Record<Alert["severity"], { text: string; ring: string; bar: string; label: string; hex: string }> = {
  critical: { text: "text-rose-neon", ring: "border-rose-neon/40 bg-rose-neon/10", bar: "bg-rose-neon", label: "CRITICAL", hex: "#ff4d6d" },
  high:     { text: "text-amber-neon", ring: "border-amber-neon/40 bg-amber-neon/10", bar: "bg-amber-neon", label: "HIGH", hex: "#ffb020" },
  medium:   { text: "text-teal-neon", ring: "border-teal-neon/40 bg-teal-neon/10", bar: "bg-teal-neon", label: "MEDIUM", hex: "#3cd6c8" },
  low:      { text: "text-emerald-neon", ring: "border-emerald-neon/40 bg-emerald-neon/10", bar: "bg-emerald-neon", label: "LOW", hex: "#4ade80" },
};

type Category = Alert["category"];
const categoriesAll: Category[] = ["health", "environment", "traffic", "safety", "utility"];

const catIcon: Record<Category, typeof Activity> = {
  health: Activity, environment: Wind, traffic: Car, safety: ShieldAlert, utility: Droplet,
};
const catLabel: Record<Category, { text: string; tone: string; ring: string }> = {
  health:      { text: "Health",      tone: "text-rose-neon",    ring: "border-rose-neon/40 bg-rose-neon/10" },
  environment: { text: "Environment", tone: "text-teal-neon",    ring: "border-teal-neon/40 bg-teal-neon/10" },
  traffic:     { text: "Traffic",     tone: "text-amber-neon",   ring: "border-amber-neon/40 bg-amber-neon/10" },
  safety:      { text: "Safety",      tone: "text-indigo-neon",  ring: "border-indigo-neon/40 bg-indigo-neon/10" },
  utility:     { text: "Utility",     tone: "text-emerald-neon", ring: "border-emerald-neon/40 bg-emerald-neon/10" },
};

const timeRanges = [
  { key: "15m", label: "15 min", minutes: 15 },
  { key: "1h",  label: "1 hour", minutes: 60 },
  { key: "6h",  label: "6 hours", minutes: 360 },
  { key: "24h", label: "24 hours", minutes: 1440 },
  { key: "all", label: "All time", minutes: Infinity },
] as const;
type TimeKey = (typeof timeRanges)[number]["key"];

type Severity = Alert["severity"];
const severities: Severity[] = ["critical", "high", "medium", "low"];

// ---------- Plain-English "what to do next" ----------
function nextStepFor(a: Alert): string {
  const isCritical = a.severity === "critical";
  const isHigh = a.severity === "high";
  switch (a.category) {
    case "health":
      if (isCritical) return "Dispatch mobile clinic team and issue a public health advisory for the ward.";
      if (isHigh)     return "Alert the ward clinic supervisor and prep overflow capacity.";
      return "Log for trend review and notify the ward health officer.";
    case "environment":
      if (isCritical) return "Trigger air-quality warning to residents and inspect nearby industrial sources.";
      if (isHigh)     return "Advise sensitive residents to limit outdoor exposure; recheck in 30 min.";
      return "Watch the trend; escalate if the reading rises for two cycles.";
    case "traffic":
      if (isCritical) return "Deploy signal-priority override and route buses to detour lanes.";
      if (isHigh)     return "Notify traffic control to adjust signals on the corridor.";
      return "Monitor congestion ratio; auto-resolves when it clears.";
    case "safety":
      if (isCritical) return "Dispatch nearest patrol unit and open a crowd-management workflow.";
      return "Flag to the ward safety officer for on-ground verification.";
    case "utility":
      if (isCritical) return "Dispatch maintenance crew immediately and notify affected residents.";
      return "Create a service ticket and monitor for recurrence.";
  }
}

// ---------- Sector metric history for the drawer sparkline ----------
type MetricSnapshot = { t: number; aqi?: number; pollen?: number; temp?: number; trafficPct?: number };
function useMetricHistory(metrics: WardMetrics[] | undefined, fetchedAt: string | undefined) {
  const historyRef = useRef<Map<string, MetricSnapshot[]>>(new Map());
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!metrics || !fetchedAt) return;
    const t = new Date(fetchedAt).getTime();
    const h = historyRef.current;
    for (const m of metrics) {
      const arr = h.get(m.sector) ?? [];
      if (arr.length && arr[arr.length - 1].t === t) continue;
      arr.push({ t, aqi: m.aqi, pollen: m.pollenUpi, temp: m.tempC, trafficPct: m.trafficDelayPct });
      while (arr.length > 24) arr.shift();
      h.set(m.sector, arr);
    }
    setTick((n) => n + 1);
  }, [metrics, fetchedAt]);
  return historyRef.current;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="text-[10px] text-muted-foreground italic">Collecting readings…</div>;
  const w = 200, h = 40, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
      <circle cx={w - pad} cy={h - pad - ((values[values.length - 1] - min) / span) * (h - pad * 2)} r="2.5" fill={color} />
    </svg>
  );
}

function AlertsPage() {
  const { data: alertsData, loading, error } = useFirestoreAlerts();
  const { data: liveData, isFetching: liveFetching, isPending: livePending } = useLiveHotspots();
  const firestoreAlerts = alertsData ?? [];
  const googleAlerts = useMemo(() => deriveGoogleAlerts(liveData), [liveData]);
  const alerts = useMemo(() => {
    const seen = new Set<string>();
    const merged: Alert[] = [];
    for (const a of [...googleAlerts, ...firestoreAlerts]) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      merged.push(a);
    }
    return merged;
  }, [googleAlerts, firestoreAlerts]);
  const history = useMetricHistory(liveData?.metrics, liveData?.fetchedAt);
  const search = Route.useSearch();

  const initialSev = (): Set<Severity> => {
    if (!search.sev) return new Set(severities);
    const parts = search.sev.split(",").filter((s: string): s is Severity => (severities as string[]).includes(s));
    return parts.length ? new Set(parts) : new Set(severities);
  };

  const [sev, setSev] = useState<Set<Severity>>(initialSev);
  const [cats, setCats] = useState<Set<Category>>(new Set(categoriesAll));
  const [sector, setSector] = useState<string>(search.sector ?? "all");
  const [range, setRange] = useState<TimeKey>(search.range ?? "24h");
  const [status, setStatus] = useState<"all" | "open" | "automated" | "resolved">(search.status ?? "all");
  const [sectorOpen, setSectorOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (search.sector !== undefined) setSector(search.sector);
    if (search.range !== undefined) setRange(search.range);
    if (search.status !== undefined) setStatus(search.status);
    if (search.sev !== undefined) setSev(initialSev());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.sector, search.range, search.sev, search.status]);

  const sectors = useMemo(() => Array.from(new Set(alerts.map((a) => a.sector))).sort(), [alerts]);
  const rangeMin = timeRanges.find((r) => r.key === range)!.minutes;

  const filtered = useMemo(() => alerts.filter((a) =>
    sev.has(a.severity)
    && cats.has(a.category)
    && (sector === "all" || a.sector === sector)
    && a.ageMin <= rangeMin
    && (status === "all" || a.status === status)
  ), [alerts, sev, cats, sector, rangeMin, status]);

  // Prune selection to visible + open, non-google alerts.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(filtered.map((a) => a.id));
      const next = new Set<string>();
      for (const id of prev) if (visible.has(id)) next.add(id);
      return next;
    });
  }, [filtered]);

  const counts = useMemo(() => ({
    critical: filtered.filter((a) => a.severity === "critical" && a.status === "open").length,
    high: filtered.filter((a) => a.severity === "high" && a.status === "open").length,
    open: filtered.filter((a) => a.status === "open").length,
    automated: filtered.filter((a) => a.status === "automated").length,
    resolved: filtered.filter((a) => a.status === "resolved").length,
  }), [filtered]);

  function toggleSev(s: Severity) {
    setSev((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }
  function toggleCat(c: Category) {
    setCats((prev) => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  function resetFilters() {
    setSev(new Set(severities));
    setCats(new Set(categoriesAll));
    setSector("all");
    setRange("24h");
    setStatus("all");
  }

  const activeFilterCount =
    (sev.size !== severities.length ? 1 : 0)
    + (cats.size !== categoriesAll.length ? 1 : 0)
    + (sector !== "all" ? 1 : 0)
    + (range !== "24h" ? 1 : 0)
    + (status !== "all" ? 1 : 0);

  // ---------- Bulk actions ----------
  const bulkTargets = useMemo(
    () => filtered.filter((a) => selected.has(a.id) && !a.id.startsWith("google-")),
    [filtered, selected],
  );
  const selectableIds = useMemo(
    () => filtered.filter((a) => !a.id.startsWith("google-")).map((a) => a.id),
    [filtered],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }
  async function bulkUpdate(next: "automated" | "resolved") {
    if (!bulkTargets.length) return;
    setBulkBusy(true);
    const targets = bulkTargets.filter((a) => next === "automated" ? a.status === "open" : a.status !== "resolved");
    const results = await Promise.allSettled(targets.map((a) => updateAlertStatus(a.id, next)));
    setBulkBusy(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    if (ok) toast.success(`${ok} alert${ok > 1 ? "s" : ""} → ${next}`);
    if (fail) toast.error(`${fail} update${fail > 1 ? "s" : ""} failed`);
    setSelected(new Set());
  }

  const drawerAlert = drawerId ? alerts.find((a) => a.id === drawerId) ?? null : null;
  const drawerMetric = drawerAlert ? liveData?.metrics.find((m) => m.sector === drawerAlert.sector) : undefined;
  const drawerHistory = drawerAlert ? history.get(drawerAlert.sector) ?? [] : [];

  const svc = liveData?.services;
  const syncedChip = (label: string, s: { ok: boolean; succeeded: number; attempted: number } | undefined) => {
    if (!s || s.attempted === 0) return { label, tone: "border-border text-muted-foreground", text: "waiting" };
    if (!s.ok) return { label, tone: "border-rose-neon/40 bg-rose-neon/10 text-rose-neon", text: `${s.succeeded}/${s.attempted} · degraded` };
    return { label, tone: "border-emerald-neon/40 bg-emerald-neon/10 text-emerald-neon", text: `${s.succeeded}/${s.attempted} live` };
  };
  const signalChips = [
    { ...syncedChip("Health · Pollen", svc?.pollen), icon: Flower2 },
    { ...syncedChip("Environment · Air Quality", svc?.airQuality), icon: WindIcon },
    { ...syncedChip("Environment · Weather", svc?.weather), icon: Thermometer },
    { ...syncedChip("Traffic · Routes", svc?.traffic), icon: TrafficCone },
  ];

  return (
    <AppShell>
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Matches", value: filtered.length, tone: "text-foreground" },
          { label: "Critical", value: counts.critical, tone: "text-rose-neon" },
          { label: "High", value: counts.high, tone: "text-amber-neon" },
          { label: "Automated", value: counts.automated, tone: "text-indigo-neon" },
          { label: "Resolved", value: counts.resolved, tone: "text-emerald-neon" },
        ].map((s) => (
          <div key={s.label} className="glass-panel rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className={cn("text-2xl font-semibold mt-1", s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mt-6 glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-3.5 w-3.5 text-indigo-neon" />
          <div className="text-xs font-semibold">Filters</div>
          {activeFilterCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-neon/15 text-indigo-neon border border-indigo-neon/30">{activeFilterCount} active</span>
          )}
          <button onClick={resetFilters} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Category chips row (instant refilter) */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {categoriesAll.map((c) => {
              const on = cats.has(c);
              const t = catLabel[c];
              const Icon = catIcon[c];
              const n = alerts.filter((a) => a.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => toggleCat(c)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition inline-flex items-center gap-1.5",
                    on ? cn(t.ring, t.tone) : "border-border text-muted-foreground hover:text-foreground opacity-60",
                  )}
                >
                  <Icon className="h-3 w-3" /> {t.text}
                  <span className="text-[10px] opacity-80">· {n}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Severity */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Severity</div>
            <div className="flex flex-wrap gap-1.5">
              {severities.map((s) => {
                const on = sev.has(s);
                const t = sevMap[s];
                return (
                  <button key={s} onClick={() => toggleSev(s)} className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
                    on ? cn(t.ring, t.text) : "border-border text-muted-foreground hover:text-foreground opacity-60",
                  )}>
                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle", t.bar)} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Sector</div>
            <div className="relative">
              <button
                onClick={() => setSectorOpen((o) => !o)}
                className="w-full text-left text-xs px-3 py-1.5 rounded-md border border-border bg-surface-1/60 hover:bg-surface-2 flex items-center justify-between"
              >
                <span>{sector === "all" ? "All sectors" : sector}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {sectorOpen && (
                <div className="absolute z-20 mt-1 w-full glass-panel rounded-lg p-1 max-h-56 overflow-y-auto animate-rise">
                  {["all", ...sectors].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSector(s); setSectorOpen(false); }}
                      className={cn(
                        "w-full text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-surface-2 transition",
                        sector === s && "bg-indigo-neon/15 text-indigo-neon",
                      )}
                    >{s === "all" ? "All sectors" : s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Time range */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Time range</div>
            <div className="flex flex-wrap gap-1.5">
              {timeRanges.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-md border transition",
                    range === r.key
                      ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >{r.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</div>
          {(["all", "open", "automated", "resolved"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn(
              "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
              status === s ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon" : "border-border text-muted-foreground hover:text-foreground",
            )}>{s}</button>
          ))}
        </div>
      </div>

      {/* Sync status strip */}
      <div className="mt-4 glass-panel rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Radio className={cn("h-3.5 w-3.5", liveFetching ? "text-indigo-neon animate-pulse" : "text-teal-neon")} />
          <span className="text-[11px] font-semibold">Live signals</span>
          <span className="text-[11px] text-muted-foreground">
            {liveFetching ? "refreshing…" : liveData ? `updated ${new Date(liveData.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · next refresh in ≤5 min` : "waiting for first sync"}
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {googleAlerts.length} from Google · {firestoreAlerts.length} from Firestore
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {signalChips.map((c) => (
            <span key={c.label} className={cn("text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1", c.tone)}>
              <c.icon className="h-3 w-3" /> {c.label} · {c.text}
            </span>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-3 glass-panel rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 border border-indigo-neon/40 animate-rise">
          <span className="text-xs font-semibold text-indigo-neon">{selected.size} selected</span>
          <span className="text-[11px] text-muted-foreground">
            {bulkTargets.length !== selected.size && `${selected.size - bulkTargets.length} skipped (live Google signals)`}
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
          >Clear</button>
          <button
            disabled={bulkBusy || !bulkTargets.length}
            onClick={() => bulkUpdate("automated")}
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Automate all
          </button>
          <button
            disabled={bulkBusy || !bulkTargets.length}
            onClick={() => bulkUpdate("resolved")}
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" /> Resolve all
          </button>
        </div>
      )}

      {/* Select-all row */}
      {filtered.length > 0 && selectableIds.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-3.5 w-3.5 rounded border-border accent-indigo-neon"
          />
          <span>Select all ({selectableIds.length} actionable)</span>
        </div>
      )}

      {/* Cards */}
      <div className="mt-3 space-y-3">
        {loading || livePending ? (
          <LoadingSyncState signalChips={signalChips} />
        ) : error ? (
          <ErrorState
            title="Live alerts stream unavailable"
            hint={`Firestore: ${error}. Check your Firebase config and the "alerts" collection permissions.`}
            onRetry={() => window.location.reload()}
          />
        ) : alerts.length === 0 ? (
          <EmptySyncState signalChips={signalChips} />
        ) : (
          <>
            {filtered.map((a) => {
              const s = sevMap[a.severity] ?? sevMap.medium;
              const Icon = catIcon[a.category] ?? Activity;
              const isGoogleDerived = a.id.startsWith("google-");
              const isSelected = selected.has(a.id);
              const nextStep = nextStepFor(a);
              return (
                <div
                  key={a.id}
                  className={cn(
                    "glass-panel rounded-2xl p-4 md:p-5 relative overflow-hidden animate-rise transition",
                    a.status !== "open" && "opacity-70",
                    isSelected && "ring-1 ring-indigo-neon/60",
                  )}
                >
                  <div className={cn("absolute left-0 top-0 h-full w-1", s.bar)} />
                  <div className="flex items-start gap-3 md:gap-4">
                    {!isGoogleDerived && (
                      <input
                        type="checkbox"
                        aria-label="Select alert"
                        checked={isSelected}
                        onChange={() => toggleSelect(a.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 h-4 w-4 rounded border-border accent-indigo-neon shrink-0"
                      />
                    )}
                    <button
                      onClick={() => setDrawerId(a.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className={cn("grid place-items-center h-11 w-11 rounded-xl border shrink-0", s.ring, s.text)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={cn("text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded border", s.ring, s.text)}>{s.label}</span>
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-flex items-center gap-1", catLabel[a.category].ring, catLabel[a.category].tone)}>
                              <Icon className="h-3 w-3" /> {catLabel[a.category].text}
                            </span>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.sector}</span>
                            <span className="text-[10px] text-muted-foreground">· {a.ts}</span>
                            {isGoogleDerived && (
                              <span className="text-[10px] font-semibold text-teal-neon inline-flex items-center gap-1">
                                <Radio className="h-3 w-3" /> Live signal
                              </span>
                            )}
                            {a.status === "automated" && <span className="text-[10px] font-semibold text-indigo-neon">⚡ Workflow running</span>}
                            {a.status === "resolved" && <span className="text-[10px] font-semibold text-emerald-neon">✓ Resolved</span>}
                          </div>
                          <div className="text-base md:text-lg font-semibold leading-snug tracking-tight">{a.title}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">{a.detail}</div>
                          <div className="mt-2 text-xs text-foreground/90 border-l-2 border-indigo-neon/60 pl-2">
                            <span className="text-[10px] uppercase tracking-widest text-indigo-neon mr-1.5">What to do next</span>
                            {nextStep}
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="flex flex-col md:flex-row gap-2 shrink-0">
                      <button
                        disabled={a.status !== "open" || isGoogleDerived}
                        title={isGoogleDerived ? "Live Google signal — resolves automatically when the metric clears" : undefined}
                        onClick={async () => {
                          const prev = a.status;
                          try {
                            await updateAlertStatus(a.id, "automated");
                            toast.success("⚡ Automated workflow dispatched", {
                              description: `${a.title} · ${a.sector}`,
                              action: { label: "Undo", onClick: () => updateAlertStatus(a.id, prev).then(() => toast("Automation reverted")) },
                            });
                          } catch (err) {
                            toast.error("Firestore write failed", { description: err instanceof Error ? err.message : "Unknown error" });
                          }
                        }}
                        className="text-xs font-medium px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 hover:brightness-110 transition"
                      >
                        <Zap className="h-3.5 w-3.5" /> Automate
                      </button>
                      <button
                        disabled={a.status === "resolved" || isGoogleDerived}
                        title={isGoogleDerived ? "Live Google signal — resolves automatically when the metric clears" : undefined}
                        onClick={async () => {
                          const prev = a.status;
                          try {
                            await updateAlertStatus(a.id, "resolved");
                            toast.success("Alert marked resolved", {
                              description: `${a.title} · ${a.sector}`,
                              action: { label: "Undo", onClick: () => updateAlertStatus(a.id, prev).then(() => toast("Resolution reverted")) },
                            });
                          } catch (err) {
                            toast.error("Firestore write failed", { description: err instanceof Error ? err.message : "Unknown error" });
                          }
                        }}
                        className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
                      >
                        <Check className="h-3.5 w-3.5" /> Resolve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <NoMatchState onReset={resetFilters} />
            )}
          </>
        )}
      </div>

      {/* Detail drawer */}
      {drawerAlert && (
        <AlertDetailDrawer
          alert={drawerAlert}
          metric={drawerMetric}
          history={drawerHistory}
          nextStep={nextStepFor(drawerAlert)}
          onClose={() => setDrawerId(null)}
        />
      )}
    </AppShell>
  );
}

// ---------- Sub-components ----------

function LoadingSyncState({ signalChips }: { signalChips: Array<{ label: string; text: string; tone: string; icon: typeof Activity }> }) {
  return (
    <div className="glass-panel rounded-2xl p-6 animate-rise">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-neon" />
        <div className="font-semibold">Syncing live signals</div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pulling the latest Google Maps Platform readings for each ward. Alerts appear here as soon as a threshold is crossed. Refresh cadence: every 5 minutes.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {signalChips.map((c) => (
          <span key={c.label} className={cn("text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1", c.tone)}>
            <c.icon className="h-3 w-3" /> {c.label} · {c.text}
          </span>
        ))}
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

function EmptySyncState({ signalChips }: { signalChips: Array<{ label: string; text: string; tone: string; icon: typeof Activity }> }) {
  return (
    <div className="glass-panel rounded-2xl p-8 text-center animate-rise">
      <div className="mx-auto h-12 w-12 grid place-items-center rounded-full border border-emerald-neon/40 bg-emerald-neon/10 text-emerald-neon mb-4">
        <Check className="h-6 w-6" />
      </div>
      <div className="text-lg font-semibold">All clear across the city</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
        No anomalies right now. We're continuously watching four Google Maps signals plus your Firestore alert stream. New alerts will show up here automatically the moment a reading crosses a threshold.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 mt-4">
        {signalChips.map((c) => (
          <span key={c.label} className={cn("text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1", c.tone)}>
            <c.icon className="h-3 w-3" /> {c.label} · {c.text}
          </span>
        ))}
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground">Live signals refresh every 5 minutes.</div>
    </div>
  );
}

function NoMatchState({ onReset }: { onReset: () => void }) {
  return (
    <div className="glass-panel rounded-2xl p-6 text-center animate-rise">
      <AlertTriangle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
      <div className="font-semibold">No alerts match your filters</div>
      <p className="text-sm text-muted-foreground mt-1">Try widening the time range, adding categories back, or clearing the sector.</p>
      <button onClick={onReset} className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface-2 inline-flex items-center gap-1.5">
        <RotateCcw className="h-3 w-3" /> Reset filters
      </button>
    </div>
  );
}

function AlertDetailDrawer({
  alert, metric, history, nextStep, onClose,
}: {
  alert: Alert;
  metric: WardMetrics | undefined;
  history: MetricSnapshot[];
  nextStep: string;
  onClose: () => void;
}) {
  const s = sevMap[alert.severity];
  const cat = catLabel[alert.category];
  const Icon = catIcon[alert.category];
  const isGoogleDerived = alert.id.startsWith("google-");

  // Pick the metric series relevant to the alert.
  const series = useMemo(() => {
    let values: number[] = [];
    let label = "Reading";
    let unit = "";
    let color = s.hex;
    if (alert.id.startsWith("google-aq-")) {
      values = history.map((h) => h.aqi).filter((v): v is number => typeof v === "number");
      label = "AQI"; unit = "";
    } else if (alert.id.startsWith("google-pl-")) {
      values = history.map((h) => h.pollen).filter((v): v is number => typeof v === "number");
      label = "Pollen UPI"; unit = " / 5";
    } else if (alert.id.startsWith("google-wx-")) {
      values = history.map((h) => h.temp).filter((v): v is number => typeof v === "number");
      label = "Surface temperature"; unit = "°C";
    } else if (alert.id.startsWith("google-tr-")) {
      values = history.map((h) => h.trafficPct).filter((v): v is number => typeof v === "number");
      label = "Congestion vs free-flow"; unit = "%";
    }
    return { values, label, unit, color };
  }, [alert.id, history, s.hex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button onClick={onClose} aria-label="Close" className="flex-1 bg-background/70 backdrop-blur-sm" />
      <aside className="w-full max-w-md h-full glass-panel border-l border-border overflow-y-auto animate-rise">
        <div className="sticky top-0 z-10 flex items-center gap-2 p-4 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className={cn("grid place-items-center h-9 w-9 rounded-lg border", s.ring, s.text)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded border", s.ring, s.text)}>{s.label}</span>
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", cat.ring, cat.tone)}>{cat.text}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{alert.sector} · {alert.ts}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 grid place-items-center rounded-lg border border-border hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-lg font-semibold leading-snug tracking-tight">{alert.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{alert.detail}</div>
          </div>

          <div className="rounded-lg border border-indigo-neon/40 bg-indigo-neon/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-indigo-neon mb-1">What to do next</div>
            <div className="text-sm">{nextStep}</div>
          </div>

          {isGoogleDerived && metric && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Live metrics · {metric.sector}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {typeof metric.aqi === "number" && <MetricCell label="AQI" value={`${metric.aqi}${metric.aqiCategory ? ` (${metric.aqiCategory})` : ""}`} />}
                {metric.dominantPollutant && <MetricCell label="Dominant pollutant" value={metric.dominantPollutant} />}
                {typeof metric.pollenUpi === "number" && <MetricCell label="Pollen UPI" value={`${metric.pollenUpi}${metric.pollenType ? ` · ${metric.pollenType}` : ""}`} />}
                {typeof metric.tempC === "number" && <MetricCell label="Temperature" value={`${metric.tempC.toFixed(1)}°C${typeof metric.feelsLikeC === "number" ? ` (feels ${metric.feelsLikeC.toFixed(1)}°C)` : ""}`} />}
                {metric.weatherCondition && <MetricCell label="Conditions" value={metric.weatherCondition} />}
                {typeof metric.trafficDelayPct === "number" && <MetricCell label="Traffic delay" value={`${metric.trafficDelayPct >= 0 ? "+" : ""}${metric.trafficDelayPct}% vs free-flow`} />}
              </div>
            </div>
          )}

          {isGoogleDerived && series.values.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{series.label} · recent trend</div>
                <div className="text-[10px] text-muted-foreground">last {series.values.length} refresh{series.values.length > 1 ? "es" : ""}</div>
              </div>
              <Sparkline values={series.values} color={series.color} />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>min {Math.min(...series.values).toFixed(1)}{series.unit}</span>
                <span>now {series.values[series.values.length - 1].toFixed(1)}{series.unit}</span>
                <span>max {Math.max(...series.values).toFixed(1)}{series.unit}</span>
              </div>
            </div>
          )}

          {isGoogleDerived && series.values.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              Trend chart appears after two refresh cycles (~10 minutes).
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={alert.status !== "open" || isGoogleDerived}
              onClick={async () => {
                try { await updateAlertStatus(alert.id, "automated"); toast.success("⚡ Automated workflow dispatched"); onClose(); }
                catch (err) { toast.error("Firestore write failed", { description: err instanceof Error ? err.message : "Unknown error" }); }
              }}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            ><Zap className="h-3.5 w-3.5" /> Automate</button>
            <button
              disabled={alert.status === "resolved" || isGoogleDerived}
              onClick={async () => {
                try { await updateAlertStatus(alert.id, "resolved"); toast.success("Alert marked resolved"); onClose(); }
                catch (err) { toast.error("Firestore write failed", { description: err instanceof Error ? err.message : "Unknown error" }); }
              }}
              className="flex-1 text-xs px-3 py-2 rounded-lg border border-border hover:bg-surface-2 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            ><Check className="h-3.5 w-3.5" /> Resolve</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-surface-1/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}
