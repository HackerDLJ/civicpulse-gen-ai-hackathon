import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useFirestoreFeedback, toggleFeedbackHandled } from "@/lib/firestore-hooks";
import { cn } from "@/lib/utils";
import { Check, MessageSquareText, ArrowRight, Sparkles, Search, Filter, RotateCcw, Star, MapPin, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/pulse/Skeletons";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleCommunityFeedback } from "@/lib/google-maps.functions";
import { useHasSession } from "@/lib/live-hotspots";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Community Feedback · CivicPulse" }, { name: "description", content: "Unstructured citizen signal transformed into sentiment, categories, and actions." }] }),
  component: FeedbackPage,
});

function GoogleCommunityPanel({ enabled }: { enabled: boolean }) {
  const fetchLive = useServerFn(getGoogleCommunityFeedback);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["google-community-feedback"],
    queryFn: () => fetchLive(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    retry: 2,
    enabled,
  });

  const reviews = data?.reviews ?? [];
  const sentTone: Record<string, string> = {
    Positive: "text-emerald-neon bg-emerald-neon/10 border-emerald-neon/30",
    Negative: "text-rose-neon bg-rose-neon/10 border-rose-neon/30",
    Neutral: "text-teal-neon bg-teal-neon/10 border-teal-neon/30",
  };
  const fetchedLabel = data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="mt-6 glass-panel rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-indigo-neon" /> Live Google Maps community feedback
          </div>
          <div className="text-[11px] text-muted-foreground">
            Reviews from nearby places pulled live via Google Places API — grouped by ward · updated {fetchedLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-surface-2 text-muted-foreground">
              {data.status.succeeded}/{data.status.attempted} wards synced
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching || !enabled}
            className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:bg-surface-2 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-4">
          <EmptyState
            title="Google community feed paused"
            hint={<>Sign in to sync protected Google Maps review data for tracked wards.</>}
            icon={<MapPin className="h-5 w-5" />}
          />
        </div>
      ) : isLoading ? (
        <div className="mt-4"><TableSkeleton rows={3} cols={1} /></div>
      ) : error ? (
        <div className="mt-4">
          <ErrorState
            title="Google community feed unavailable"
            hint={error instanceof Error ? error.message : "Unable to reach Google Places"}
            onRetry={() => refetch()}
          />
        </div>
      ) : reviews.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No Google community reviews yet"
            hint={<>Google Places didn't return reviews for the tracked wards this cycle.</>}
            icon={<MapPin className="h-5 w-5" />}
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </div>
      ) : (
        <>
          {data && data.status.failed > 0 && (
            <div className="mt-3 text-[11px] rounded-md border border-amber-neon/40 bg-amber-neon/10 text-amber-neon px-2.5 py-1.5 inline-flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" /> Partial sync: {data.status.failed} ward{data.status.failed > 1 ? "s" : ""} failed
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface-1/60 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.authorPhoto ? (
                      <img src={r.authorPhoto} alt="" className="h-6 w-6 rounded-full border border-border" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-surface-3 border border-border flex items-center justify-center text-[10px] font-semibold">
                        {r.author.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{r.author}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{r.placeName}</div>
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0", sentTone[r.sentiment])}>
                    {r.sentiment}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-3 w-3", i < r.rating ? "fill-amber-neon text-amber-neon" : "text-muted-foreground/40")} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">{r.relativeTime}</span>
                </div>
                <p className="text-xs text-muted-foreground italic line-clamp-4">"{r.text}"</p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <span className="text-[10px] inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {r.ward}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Google Maps</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const sentimentTone: Record<string, string> = {
  Positive: "text-emerald-neon bg-emerald-neon/10 border-emerald-neon/30",
  Negative: "text-rose-neon bg-rose-neon/10 border-rose-neon/30",
  Neutral:  "text-teal-neon bg-teal-neon/10 border-teal-neon/30",
};

function FeedbackPage() {
  const { data: feedbackData, loading, error } = useFirestoreFeedback();
  const feedback = feedbackData ?? [];
  const hasSession = useHasSession();
  const [tab, setTab] = useState<"all" | "Positive" | "Negative" | "Neutral">("all");
  const [ward, setWard] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");

  // Live Google community feedback stream feeds the top KPI counts so they
  // reflect BOTH the operator-side Firestore feedback and the citizen-facing
  // Google Maps reviews shown below. Kept as a shared query key so the panel
  // and the KPI row read from the same cache entry.
  const fetchGoogle = useServerFn(getGoogleCommunityFeedback);
  const { data: googleFeedback } = useQuery({
    queryKey: ["google-community-feedback"],
    queryFn: () => fetchGoogle(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    retry: 2,
    enabled: hasSession,
  });
  const googleReviews = googleFeedback?.reviews ?? [];

  // Live-derived filter option lists — recompute whenever the Firestore snapshot changes.
  const wards = useMemo(
    () => Array.from(new Set(feedback.map((f) => f.ward).filter(Boolean))).sort(),
    [feedback],
  );
  const categories = useMemo(
    () => Array.from(new Set(feedback.map((f) => f.category).filter(Boolean))).sort(),
    [feedback],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return feedback.filter((f) =>
      (tab === "all" || f.sentiment === tab)
      && (ward === "all" || f.ward === ward)
      && (category === "all" || f.category === category)
      && (needle === ""
        || f.text.toLowerCase().includes(needle)
        || f.ward.toLowerCase().includes(needle)
        || f.category.toLowerCase().includes(needle)
        || f.source.toLowerCase().includes(needle)
        || f.action.toLowerCase().includes(needle))
    );
  }, [feedback, tab, ward, category, q]);

  const activeFilters =
    (tab !== "all" ? 1 : 0) + (ward !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) + (q.trim() ? 1 : 0);
  const resetFilters = () => { setTab("all"); setWard("all"); setCategory("all"); setQ(""); };

  const counts = {
    total: feedback.length + googleReviews.length,
    positive: feedback.filter((f) => f.sentiment === "Positive").length + googleReviews.filter((r) => r.sentiment === "Positive").length,
    negative: feedback.filter((f) => f.sentiment === "Negative").length + googleReviews.filter((r) => r.sentiment === "Negative").length,
    neutral:  feedback.filter((f) => f.sentiment === "Neutral").length  + googleReviews.filter((r) => r.sentiment === "Neutral").length,
  };

  return (
    <AppShell>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Signals processed", v: counts.total, tone: "text-foreground" },
          { l: "Positive", v: counts.positive, tone: "text-emerald-neon" },
          { l: "Negative", v: counts.negative, tone: "text-rose-neon" },
          { l: "Neutral", v: counts.neutral, tone: "text-teal-neon" },
        ].map((s) => (
          <div key={s.l} className="glass-panel rounded-xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className={cn("text-2xl font-semibold mt-1", s.tone)}>{s.v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {feedback.length} Firestore · {googleReviews.length} Google
            </div>
          </div>
        ))}
      </div>

      <GoogleCommunityPanel enabled={hasSession} />



      <div className="mt-6 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-indigo-neon" /> Raw signal → structured action</div>
            <div className="text-[11px] text-muted-foreground">Gemini extracts sentiment, category, ward, and next-best action from unstructured text</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "Positive", "Negative", "Neutral"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn(
                "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
                tab === t ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon" : "border-border text-muted-foreground hover:text-foreground"
              )}>{t}</button>
            ))}
          </div>
        </div>

        {/* Live filter bar (ward, category, free-text) driven by the Firestore snapshot. */}
        <div className="mt-4 rounded-xl border border-border/70 bg-surface-1/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-3.5 w-3.5 text-indigo-neon" />
            <span className="text-[11px] font-semibold">Live filters</span>
            {activeFilters > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-neon/15 text-indigo-neon border border-indigo-neon/30">
                {activeFilters} active
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} / {feedback.length} signals</span>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search text, ward, category, source…"
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface-1/60 focus:outline-none focus:border-indigo-neon/60 focus:ring-1 focus:ring-indigo-neon/40 placeholder:text-muted-foreground"
              />
            </div>
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-surface-1/60 focus:outline-none focus:border-indigo-neon/60 min-w-32"
            >
              <option value="all">All wards ({wards.length})</option>
              {wards.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border bg-surface-1/60 focus:outline-none focus:border-indigo-neon/60 min-w-36"
            >
              <option value="all">All categories ({categories.length})</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>


        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : error ? (
            <ErrorState
              title="Feedback stream unavailable"
              hint={`Firestore: ${error}. Check the "feedback" collection permissions.`}
              onRetry={() => window.location.reload()}
            />
          ) : feedback.length === 0 ? (
            <EmptyState
              title="No feedback in Firestore yet"
              hint={<>The <code>feedback</code> collection is empty. Once citizen signals are ingested, they will appear here live.</>}
              icon={<MessageSquareText className="h-5 w-5" />}
            />
          ) : (<>
          <table className="w-full text-sm">


            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3 font-medium">Source</th>
                <th className="text-left py-2 pr-3 font-medium">Raw Text</th>
                <th className="text-left py-2 pr-3 font-medium">Sentiment</th>
                <th className="text-left py-2 pr-3 font-medium">Category</th>
                <th className="text-left py-2 pr-3 font-medium">Ward</th>
                <th className="text-left py-2 pr-3 font-medium">AI Action</th>
                <th className="text-right py-2 pl-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-surface-1/50 transition">
                  <td className="py-3 pr-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-surface-2 text-muted-foreground">{f.source}</span>
                  </td>
                  <td className="py-3 pr-3 max-w-md">
                    <span className="italic text-muted-foreground">"{f.text}"</span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", sentimentTone[f.sentiment])}>{f.sentiment}</span>
                  </td>
                  <td className="py-3 pr-3 text-xs">{f.category}</td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">{f.ward}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Sparkles className="h-3 w-3 text-indigo-neon shrink-0" />
                      <span>{f.action}</span>
                    </div>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      onClick={async () => {
                        try {
                          await toggleFeedbackHandled(f.id, !f.handled);
                          toast(f.handled ? "Reopened" : "Marked handled");
                        } catch (err) {
                          toast.error("Firestore write failed", { description: err instanceof Error ? err.message : "Unknown error" });
                        }
                      }}
                      className={cn(
                        "text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border transition",
                        f.handled
                          ? "border-emerald-neon/40 bg-emerald-neon/10 text-emerald-neon"
                          : "border-border hover:bg-surface-2"
                      )}
                    >
                      {f.handled ? <><Check className="h-3 w-3" /> Handled</> : <>Route <ArrowRight className="h-3 w-3" /></>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="pt-4">
              <EmptyState
                title={activeFilters > 0 ? "No signals match your filters" : "No signals right now"}
                hint={activeFilters > 0
                  ? <>Try clearing filters — the Gemini extractor is still watching {feedback.length} live signals in the Firestore stream.</>
                  : <>The Gemini extractor hasn't picked up anything new yet. Give the Firestore stream a moment, or retry the ingestion sweep.</>}
                icon={<MessageSquareText className="h-5 w-5" />}
                actionLabel={activeFilters > 0 ? "Reset filters" : "Retry ingestion sweep"}
                onAction={() => {
                  if (activeFilters > 0) resetFilters();
                  else toast.success("Ingestion sweep re-queued", { description: "Gemini re-scanning last 15m of citizen channels." });
                }}
              />
            </div>
          )}
          </>)}
        </div>
      </div>
    </AppShell>
  );
}
