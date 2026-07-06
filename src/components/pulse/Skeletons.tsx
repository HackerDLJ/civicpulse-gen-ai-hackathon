import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCw, Radio } from "lucide-react";

export function Skel({ className }: { className?: string }) {
  return <div className={cn("skeleton-block", className)} />;
}

/** CivicPulse KPI card skeleton. */
export function KpiCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skel className="h-2.5 w-24" />
          <Skel className="h-7 w-20" />
        </div>
        <Skel className="h-9 w-9 rounded-xl" />
      </div>
      <Skel className="mt-4 h-3 w-32" />
      <Skel className="mt-3 h-10 w-full" />
    </div>
  );
}

/** City map skeleton with scanning line. */
export function MapSkeleton() {
  return (
    <div className="relative aspect-[16/10] w-full rounded-xl border border-border overflow-hidden bg-[radial-gradient(ellipse_at_top,_oklch(0.28_0.05_262)_0%,_oklch(0.18_0.02_260)_70%)]">
      <div className="absolute inset-6 grid grid-cols-6 gap-4 opacity-40">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skel key={i} className="h-8 rounded-md" />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground glass-panel px-3 py-1.5 rounded-full">
          <Radio className="h-3 w-3 text-teal-neon pulse-dot" />
          Syncing 214 sensor nodes…
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-teal-neon/20 to-transparent"
        style={{ animation: "scan 3s linear infinite" }}
      />
    </div>
  );
}

export function StreamSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skel className="h-3.5 w-40" />
          <Skel className="h-2.5 w-32" />
        </div>
        <Skel className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-4 space-y-2 flex-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-surface-1/70 border border-border/60 px-3 py-2 space-y-1.5">
            <Skel className="h-2 w-24" />
            <Skel className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ label = "Charting" }: { label?: string }) {
  return (
    <div className="h-64 relative rounded-lg border border-border bg-surface-1/40 overflow-hidden">
      <div className="absolute inset-4 flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skel key={i} className="flex-1" style={{ height: `${25 + ((i * 13) % 60)}%` } as any} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}…
      </div>
    </div>
  );
}

export function AiThinkingSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5 animate-rise">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon grid place-items-center animate-pulse">
          <Radio className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="text-[10px] uppercase tracking-widest shimmer-text">
            Gemini · Reasoning across health, transit, environment layers
          </div>
          <Skel className="h-5 w-3/4" />
          <Skel className="h-3 w-full" />
          <Skel className="h-3 w-11/12" />
          <Skel className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skel className="h-7 w-32 rounded-lg" />
            <Skel className="h-7 w-28 rounded-lg" />
            <Skel className="h-7 w-36 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Branded empty state with optional retry. */
export function EmptyState({
  title,
  hint,
  icon,
  actionLabel,
  onAction,
  tone = "neutral",
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="glass-panel rounded-2xl p-10 text-center animate-rise">
      <div
        className={cn(
          "mx-auto h-12 w-12 rounded-2xl grid place-items-center border",
          tone === "warning"
            ? "border-amber-neon/40 bg-amber-neon/10 text-amber-neon"
            : "border-indigo-neon/40 bg-indigo-neon/10 text-indigo-neon"
        )}
      >
        {icon ?? <AlertTriangle className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">{hint}</div>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface-2 inline-flex items-center gap-1.5"
        >
          <RotateCw className="h-3 w-3" /> {actionLabel}
        </button>
      )}
    </div>
  );
}
