import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import { useStore, store } from "@/lib/pulse-data";
import { cn } from "@/lib/utils";
import { Check, MessageSquareText, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { EmptyState, TableSkeleton, useHydrated } from "@/components/pulse/Skeletons";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [{ title: "Community Feedback · CivicPulse" }, { name: "description", content: "Unstructured citizen signal transformed into sentiment, categories, and actions." }] }),
  component: FeedbackPage,
});

const sentimentTone: Record<string, string> = {
  Positive: "text-emerald-neon bg-emerald-neon/10 border-emerald-neon/30",
  Negative: "text-rose-neon bg-rose-neon/10 border-rose-neon/30",
  Neutral:  "text-teal-neon bg-teal-neon/10 border-teal-neon/30",
};

function FeedbackPage() {
  const feedback = useStore((s) => s.feedback);
  const hydrated = useHydrated(500);
  const [tab, setTab] = useState<"all" | "Positive" | "Negative" | "Neutral">("all");
  const rows = useMemo(() => tab === "all" ? feedback : feedback.filter((f) => f.sentiment === tab), [feedback, tab]);

  const counts = {
    total: feedback.length,
    positive: feedback.filter((f) => f.sentiment === "Positive").length,
    negative: feedback.filter((f) => f.sentiment === "Negative").length,
    neutral: feedback.filter((f) => f.sentiment === "Neutral").length,
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
          </div>
        ))}
      </div>

      <div className="mt-6 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-indigo-neon" /> Raw signal → structured action</div>
            <div className="text-[11px] text-muted-foreground">Gemini extracts sentiment, category, ward, and next-best action from unstructured text</div>
          </div>
          <div className="flex gap-1.5">
            {(["all", "Positive", "Negative", "Neutral"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn(
                "text-[11px] px-2.5 py-1 rounded-md border transition capitalize",
                tab === t ? "border-indigo-neon/60 bg-indigo-neon/15 text-indigo-neon" : "border-border text-muted-foreground hover:text-foreground"
              )}>{t}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {!hydrated ? <TableSkeleton rows={6} cols={7} /> : (
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
                      onClick={() => { store.handleFeedback(f.id); toast(f.handled ? "Reopened" : "Marked handled"); }}
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
                title={`No ${tab === "all" ? "" : tab.toLowerCase() + " "}signals right now`}
                hint={<>The Gemini extractor is still watching {feedback.length} live channels. Reset the filter to see everything, or retry the ingestion sweep.</>}
                icon={<MessageSquareText className="h-5 w-5" />}
                actionLabel={tab === "all" ? "Retry ingestion sweep" : "Show all signals"}
                onAction={() => {
                  if (tab === "all") toast.success("Ingestion sweep re-queued", { description: "Gemini re-scanning last 15m of citizen channels." });
                  else setTab("all");
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
