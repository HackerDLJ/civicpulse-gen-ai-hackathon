import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, store, type Alert } from "@/lib/pulse-data";
import { AlertTriangle, Zap, Check, Filter, ShieldAlert, Activity, Droplet, Car, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Live Alerts · Pulse" }, { name: "description", content: "AI-flagged anomalies with automated workflow controls." }] }),
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

function AlertsPage() {
  const alerts = useStore((s) => s.alerts);
  const [filter, setFilter] = useState<"all" | Alert["severity"]>("all");

  const filtered = useMemo(() => filter === "all" ? alerts : alerts.filter((a) => a.severity === filter), [alerts, filter]);
  const counts = useMemo(() => ({
    critical: alerts.filter((a) => a.severity === "critical" && a.status === "open").length,
    high: alerts.filter((a) => a.severity === "high" && a.status === "open").length,
    open: alerts.filter((a) => a.status === "open").length,
    automated: alerts.filter((a) => a.status === "automated").length,
    resolved: alerts.filter((a) => a.status === "resolved").length,
  }), [alerts]);

  return (
    <AppShell>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Open", value: counts.open, tone: "text-foreground" },
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

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter</div>
        {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn(
            "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
            filter === s ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon" : "border-border text-muted-foreground hover:text-foreground"
          )}>{s}</button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((a) => {
          const s = sevMap[a.severity];
          const Icon = catIcon[a.category];
          return (
            <div key={a.id} className={cn("glass-panel rounded-2xl p-4 md:p-5 relative overflow-hidden", a.status !== "open" && "opacity-70")}>
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
                    onClick={() => { store.automateAlert(a.id); toast.success("Automated workflow dispatched", { description: a.title }); }}
                    className="text-xs font-medium px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 hover:brightness-110 transition"
                  >
                    <Zap className="h-3.5 w-3.5" /> Automate
                  </button>
                  <button
                    disabled={a.status === "resolved"}
                    onClick={() => { store.resolveAlert(a.id); toast("Alert resolved", { description: a.title }); }}
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
          <div className="glass-panel rounded-2xl p-10 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-3 text-sm font-medium">No alerts in this bucket</div>
            <div className="text-xs text-muted-foreground">The grid is quiet — Pulse will surface anomalies as they emerge.</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
