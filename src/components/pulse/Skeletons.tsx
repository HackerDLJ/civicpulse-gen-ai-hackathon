import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCw, Radio, WifiOff } from "lucide-react";

/**
 * useHydrated — small helper so every route boots with CivicPulse skeletons
 * for a moment before real data is shown. Keeps the perceived latency identical
 * across every page.
 */
export function useHydrated(delay = 550) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return ready;
}

export function Skel({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("skeleton-block", className)} style={style} />;
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
          <Skel key={i} className="flex-1" style={{ height: `${25 + ((i * 13) % 60)}%` }} />
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

/** Row-list skeleton (Alerts, generic feeds). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-panel rounded-2xl p-4 md:p-5 relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1 skeleton-block" />
          <div className="flex items-center gap-4">
            <Skel className="h-11 w-11 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex gap-2">
                <Skel className="h-3 w-14" />
                <Skel className="h-3 w-20" />
                <Skel className="h-3 w-10" />
              </div>
              <Skel className="h-4 w-3/4" />
              <Skel className="h-3 w-1/2" />
            </div>
            <div className="hidden sm:flex gap-2 shrink-0">
              <Skel className="h-8 w-24 rounded-lg" />
              <Skel className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table skeleton for the Feedback grid. */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 border-b border-border pb-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => <Skel key={i} className="h-3 w-16" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 border-b border-border/40 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skel key={c} className={cn("h-3.5", c === 1 ? "w-full" : c === 5 ? "w-3/4" : "w-2/3")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Standardized error state with retry — same visual grammar as EmptyState. */
export function ErrorState({
  title = "We couldn't reach the CivicPulse mesh",
  hint = "The upstream layer returned an unexpected response. This is usually transient — retry to re-subscribe.",
  onRetry,
  retryLabel = "Retry connection",
}: {
  title?: string;
  hint?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-10 text-center border border-rose-neon/30 animate-rise">
      <div className="mx-auto h-12 w-12 rounded-2xl grid place-items-center border border-rose-neon/40 bg-rose-neon/10 text-rose-neon">
        <WifiOff className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">{hint}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-xs px-3 py-1.5 rounded-md border border-rose-neon/40 text-rose-neon hover:bg-rose-neon/10 inline-flex items-center gap-1.5"
        >
          <RotateCw className="h-3 w-3" /> {retryLabel}
        </button>
      )}
    </div>
  );
}
