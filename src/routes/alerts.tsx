import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { type Alert } from "@/lib/pulse-data";
import { useFirestoreAlerts, updateAlertStatus } from "@/lib/firestore-hooks";
import { AlertTriangle, Zap, Check, Filter, ShieldAlert, Activity, Droplet, Car, Wind, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/pulse/Skeletons";

type AlertsSearch = {
  sector?: string;
  range?: "15m" | "1h" | "6h" | "24h" | "all";
  sev?: string;    // comma-separated
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

const sevMap: Record<Alert["severity"], { text: string; ring: string; bar: string; label: string }> = {
  critical: { text: "text-rose-neon", ring: "border-rose-neon/40 bg-rose-neon/10", bar: "bg-rose-neon", label: "CRITICAL" },
  high:     { text: "text-amber-neon", ring: "border-amber-neon/40 bg-amber-neon/10", bar: "bg-amber-neon", label: "HIGH" },
  medium:   { text: "text-teal-neon", ring: "border-teal-neon/40 bg-teal-neon/10", bar: "bg-teal-neon", label: "MEDIUM" },
  low:      { text: "text-emerald-neon", ring: "border-emerald-neon/40 bg-emerald-neon/10", bar: "bg-emerald-neon", label: "LOW" },
};

const catIcon: Record<Alert["category"], typeof Activity> = {
  health: Activity, environment: Wind, traffic: Car, safety: ShieldAlert, utility: Droplet,
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

function AlertsPage() {
  const { data: alertsData, loading, error } = useFirestoreAlerts();
  const alerts = alertsData ?? [];
  const search = Route.useSearch();

  const initialSev = (): Set<Severity> => {
    if (!search.sev) return new Set(severities);
    const parts = search.sev.split(",").filter((s: string): s is Severity => (severities as string[]).includes(s));
    return parts.length ? new Set(parts) : new Set(severities);
  };

  const [sev, setSev] = useState<Set<Severity>>(initialSev);
  const [sector, setSector] = useState<string>(search.sector ?? "all");
  const [range, setRange] = useState<TimeKey>(search.range ?? "24h");
  const [status, setStatus] = useState<"all" | "open" | "automated" | "resolved">(search.status ?? "all");
  const [sectorOpen, setSectorOpen] = useState(false);

  // Re-apply when navigating in with new search params (e.g. from a KPI anomaly link).
  useEffect(() => {
    if (search.sector !== undefined) setSector(search.sector);
    if (search.range !== undefined) setRange(search.range);
    if (search.status !== undefined) setStatus(search.status);
    if (search.sev !== undefined) setSev(initialSev());
    if (search.sector || search.range) {
      toast("Filters synced from link", {
        description: [search.sector && `sector: ${search.sector}`, search.range && `window: ${search.range}`].filter(Boolean).join(" · "),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.sector, search.range, search.sev, search.status]);

  const sectors = useMemo(() => Array.from(new Set(alerts.map((a) => a.sector))).sort(), [alerts]);
  const rangeMin = timeRanges.find((r) => r.key === range)!.minutes;

  const filtered = useMemo(() => alerts.filter((a) =>
    sev.has(a.severity)
    && (sector === "all" || a.sector === sector)
    && a.ageMin <= rangeMin
    && (status === "all" || a.status === status)
  ), [alerts, sev, sector, rangeMin, status]);

  const counts = useMemo(() => ({
    critical: filtered.filter((a) => a.severity === "critical" && a.status === "open").length,
    high: filtered.filter((a) => a.severity === "high" && a.status === "open").length,
    open: filtered.filter((a) => a.status === "open").length,
    automated: filtered.filter((a) => a.status === "automated").length,
    resolved: filtered.filter((a) => a.status === "resolved").length,
  }), [filtered]);

  function toggleSev(s: Severity) {
    setSev((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }
  function resetFilters() {
    setSev(new Set(severities));
    setSector("all");
    setRange("24h");
    setStatus("all");
  }

  const activeFilterCount =
    (sev.size !== severities.length ? 1 : 0)
    + (sector !== "all" ? 1 : 0)
    + (range !== "24h" ? 1 : 0)
    + (status !== "all" ? 1 : 0);


  return (
    <AppShell>
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
                    on ? cn(t.ring, t.text) : "border-border text-muted-foreground hover:text-foreground opacity-60"
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
                        sector === s && "bg-indigo-neon/15 text-indigo-neon"
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
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >{r.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Status row */}
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</div>
          {(["all", "open", "automated", "resolved"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn(
              "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
              status === s ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon" : "border-border text-muted-foreground hover:text-foreground"
            )}>{s}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <ErrorState
            title="Live alerts stream unavailable"
            hint={`Firestore: ${error}. Check your Firebase config and the "alerts" collection permissions.`}
            onRetry={() => window.location.reload()}
          />
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No alerts in Firestore yet"
            hint={<>The <code>alerts</code> collection is empty. Once documents are added, they will stream in live.</>}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        ) : (
          <>
            {filtered.map((a) => {
              const s = sevMap[a.severity] ?? sevMap.medium;
              const Icon = catIcon[a.category] ?? Activity;
              return (
                <div key={a.id} className={cn("glass-panel rounded-2xl p-4 md:p-5 relative overflow-hidden animate-rise", a.status !== "open" && "opacity-70")}>
                  <div className={cn("absolute left-0 top-0 h-full w-1", s.bar)} />
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className={cn("grid place-items-center h-11 w-11 rounded-xl border shrink-0", s.ring, s.text)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded border", s.ring, s.text)}>{s.label}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.sector}</span>
                        <span className="text-[10px] text-muted-foreground">· {a.ts}</span>
                        {a.status === "automated" && <span className="text-[10px] font-semibold text-indigo-neon">⚡ Workflow running</span>}
                        {a.status === "resolved" && <span className="text-[10px] font-semibold text-emerald-neon">✓ Resolved</span>}
                      </div>
                      <div className="mt-1 font-semibold tracking-tight">{a.title}</div>
                      <div className="text-sm text-muted-foreground">{a.detail}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        disabled={a.status !== "open"}
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
                        disabled={a.status === "resolved"}
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
              <EmptyState
                title="No alerts match your filters"
                hint="Try widening the time range or clearing the sector selection."
                icon={<AlertTriangle className="h-5 w-5" />}
                actionLabel="Reset filters"
                onAction={resetFilters}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
