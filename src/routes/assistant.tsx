import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/pulse/AppShell";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, Send, User, Zap, ChevronRight, Radio, TrendingUp, Plus, Trash2, Download, RotateCw, MessageSquare, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AiThinkingSkeleton } from "@/components/pulse/Skeletons";
import { askGemini } from "@/lib/gemini.functions";
import { useLiveHotspots, buildAssistantContext } from "@/lib/live-hotspots";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [{ title: "AI Decision Assistant · CivicPulse" }, { name: "description", content: "Ask anything about your city. Gemini-powered municipal reasoning." }] }),
  component: AssistantPage,
});

// -------- Types --------

type ChartSpec =
  | { type: "line"; data: Array<{ x: string; y: number; y2?: number }>; keys: [string, string?] }
  | { type: "bar"; data: Array<{ x: string; y: number }>; keys: [string] };

type Answer = {
  headline: string;
  confidence: number;
  bullets: Array<{ h: string; t: string }>;
  chart?: ChartSpec;
  actions: string[];
};

type Msg =
  | { id: string; role: "user"; text: string; ts: number }
  | { id: string; role: "ai"; answer: Answer; ts: number; streaming?: boolean; regenerated?: number };

type Conversation = { id: string; title: string; messages: Msg[]; createdAt: number };

// -------- Prompt library & answer generator --------

const prompts = [
  "Forecast resource strain for next 48 hours",
  "Analyze public transit bottlenecks",
  "Summarize citizen complaints in Ward 3",
  "Where should we deploy mobile clinics tonight?",
  "What's driving the Sector B respiratory spike?",
];

function generateAnswer(query: string, seed = 0): Answer {
  const q = query.toLowerCase();
  const jitter = (n: number) => Math.round(n + (seed * 3.1 % 5) - 2);

  if (q.includes("forecast") || q.includes("resource") || q.includes("strain")) {
    return {
      headline: "Resource strain will peak at T+36h, concentrated in Health and Transit.",
      confidence: jitter(94),
      bullets: [
        { h: "Health capacity", t: "Ward 3 & Sector B project 118% clinic utilization by T+36h — 22% above safe threshold." },
        { h: "Transit load", t: "Corridors E-14 and NR-9 exceed 92% flow saturation between T+18h and T+30h." },
        { h: "Environmental co-signal", t: "AQI degradation (+18 pts) correlates with respiratory admissions, amplifying health demand." },
      ],
      chart: {
        type: "line",
        data: Array.from({ length: 12 }, (_, i) => ({ x: `T+${i * 4}h`, y: Math.round(55 + 18 * Math.sin(i / 2 + seed) + i * 1.6), y2: 80 })),
        keys: ["y", "y2"],
      },
      actions: ["Deploy Secondary Transit Units", "Pre-stage 2 Mobile Clinics · Ward 3", "Issue Public Health Advisory"],
    };
  }
  if (q.includes("transit") || q.includes("traffic") || q.includes("bottleneck")) {
    return {
      headline: "Three bottlenecks account for 71% of avoidable delay minutes today.",
      confidence: jitter(91),
      bullets: [
        { h: "Ring Rd E-14", t: "Signal desync + freight overlap between 07:40–09:10 costs ~1,240 vehicle-minutes." },
        { h: "NR-9 / 4th Ave junction", t: "Left-turn queue spillback triggers cascade every ~14 minutes." },
        { h: "Metro line B7", t: "Dwell-time drift +32s at 5 stations — driven by boarding density surge." },
      ],
      chart: {
        type: "bar",
        data: [
          { x: "Ring E-14", y: jitter(62) },
          { x: "NR-9", y: jitter(48) },
          { x: "Metro B7", y: jitter(41) },
          { x: "River Br.", y: jitter(27) },
          { x: "West Loop", y: jitter(19) },
        ],
        keys: ["y"],
      },
      actions: ["Auto-Retime Signals · E-14 Corridor", "Dispatch Traffic Marshals to NR-9", "Add 2 B7 Trains (rush window)"],
    };
  }
  if (q.includes("complaint") || q.includes("ward 3") || q.includes("citizen")) {
    return {
      headline: "Ward 3 complaints cluster around healthcare access & sanitation this week.",
      confidence: jitter(89),
      bullets: [
        { h: "Healthcare (46%)", t: "Long clinic waits (3h+), specialist availability, evening pharmacy access." },
        { h: "Sanitation (28%)", t: "Missed pickups on Maple corridor · overflowing bins near the market." },
        { h: "Public safety (17%)", t: "Streetlight outages · 7th & Maple, 11th & Oak." },
      ],
      chart: {
        type: "bar",
        data: [
          { x: "Health", y: jitter(46) },
          { x: "Sanit.", y: jitter(28) },
          { x: "Safety", y: jitter(17) },
          { x: "Transit", y: jitter(6) },
          { x: "Other", y: jitter(3) },
        ],
        keys: ["y"],
      },
      actions: ["Reassign 2 Mobile Clinics · Ward 3", "Schedule Sanitation Sweep", "Dispatch Streetlight Repair"],
    };
  }
  if (q.includes("clinic") || q.includes("mobile")) {
    return {
      headline: "Deploy mobile clinics to Sector B (2) and Ward 3 (1) between 18:00–23:00.",
      confidence: jitter(92),
      bullets: [
        { h: "Sector B", t: "Respiratory admissions +22%, AQI 148 · projected 340 walk-ins tonight." },
        { h: "Ward 3", t: "Fixed clinic at 92% capacity · overflow risk in 90 min at current rate." },
        { h: "Staffing", t: "Nearest reserve pool has 8 nurses + 2 physicians ready within 40 min." },
      ],
      chart: {
        type: "bar",
        data: [
          { x: "Sec B", y: jitter(340) },
          { x: "W3", y: jitter(180) },
          { x: "W7", y: jitter(60) },
          { x: "Down.", y: jitter(45) },
        ],
        keys: ["y"],
      },
      actions: ["Deploy 2 Units · Sector B", "Deploy 1 Unit · Ward 3", "Notify Reserve Staff Pool"],
    };
  }

  return {
    headline: "The Sector B respiratory spike is driven by a PM2.5 plume + humidity trap.",
    confidence: jitter(93),
    bullets: [
      { h: "Environmental driver", t: "Industrial belt PM2.5 rose from 34 → 71 µg/m³ over 6 hours; inversion layer traps particulates." },
      { h: "Vulnerable cohort", t: "70% of new cases are pediatric or 65+, matching high-risk demographic map." },
      { h: "Causal confidence", t: "Bayesian causal model attributes 82% of variance to PM2.5, 11% to pollen, 7% residual." },
    ],
    chart: {
      type: "line",
      data: Array.from({ length: 12 }, (_, i) => ({ x: `${i * 2}h`, y: Math.round(30 + 8 * i + Math.sin(i + seed) * 6), y2: Math.round(20 + 5 * i + Math.cos(i) * 4) })),
      keys: ["y", "y2"],
    },
    actions: ["Issue Public Health Advisory", "Trigger Industrial Emissions Audit", "Distribute N95s at Ward Centers"],
  };
}

// -------- LocalStorage persistence --------

const STORAGE_KEY = "pulse.assistant.conversations.v1";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(convs)); } catch { /* ignore */ }
}

function newConversation(): Conversation {
  return { id: "c" + Math.random().toString(36).slice(2, 9), title: "New session", messages: [], createdAt: Date.now() };
}

// -------- Streaming helper --------

function Streaming({ text }: { text: string }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text]);
  return <span>{shown}<span className="inline-block w-1.5 h-4 bg-indigo-neon align-middle ml-0.5 pulse-dot" /></span>;
}

const tooltipStyle = { background: "oklch(0.22 0.025 260)", border: "1px solid oklch(0.35 0.04 262)", borderRadius: 8, fontSize: 12 };

function AnswerCard({ m, onRegenerate }: { m: Extract<Msg, { role: "ai" }>; onRegenerate: () => void }) {
  const a = m.answer;
  return (
    <div className="glass-panel rounded-2xl p-5 animate-rise">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon grid place-items-center">
          <Sparkles className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="text-indigo-neon font-semibold">Gemini · Municipal Reasoning v3.4</span>
            {m.regenerated ? <span className="text-muted-foreground/70">· regen ×{m.regenerated}</span> : null}
            <span className="ml-auto flex items-center gap-1 text-emerald-neon">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" />
              {a.confidence}% Confidence
            </span>
          </div>
          <div className="mt-1 text-base font-semibold tracking-tight leading-snug">
            {m.streaming ? <Streaming text={a.headline} /> : a.headline}
          </div>

          {!m.streaming && (
            <>
              <div className="mt-4 space-y-2.5">
                {a.bullets.map((b, i) => (
                  <div key={i} className="flex gap-3">
                    <ChevronRight className="h-4 w-4 mt-0.5 text-indigo-neon shrink-0" />
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{b.h}:</span>{" "}
                      <span className="text-muted-foreground">{b.t}</span>
                    </div>
                  </div>
                ))}
              </div>

              {a.chart && (
                <div className="mt-5 rounded-xl border border-border bg-surface-1/60 p-3">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                    <TrendingUp className="h-3 w-3 text-teal-neon" /> Supporting data
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer>
                      {a.chart.type === "line" ? (
                        <LineChart data={a.chart.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                          <XAxis dataKey="x" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                          <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Line type="monotone" dataKey="y" stroke="var(--indigo-neon)" strokeWidth={2} dot={false} />
                          {a.chart.data[0]?.y2 !== undefined && (
                            <Line type="monotone" dataKey="y2" stroke="var(--teal-neon)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                          )}
                        </LineChart>
                      ) : (
                        <BarChart data={a.chart.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.35 0.03 262 / 0.35)" />
                          <XAxis dataKey="x" stroke="oklch(0.7 0.03 258)" fontSize={10} />
                          <YAxis stroke="oklch(0.7 0.03 258)" fontSize={10} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="y" fill="var(--indigo-neon)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Recommended Actions</div>
                <div className="flex flex-wrap gap-2">
                  {a.actions.map((act, i) => (
                    <button
                      key={i}
                      onClick={() => toast.success("Action dispatched", { description: act })}
                      className={cn(
                        "text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition",
                        i === 0
                          ? "bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground hover:brightness-110"
                          : "border border-border hover:bg-surface-2"
                      )}
                    >
                      <Zap className="h-3.5 w-3.5" /> {act}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-3 text-[11px] text-muted-foreground">
                <button onClick={onRegenerate} className="inline-flex items-center gap-1 hover:text-foreground transition">
                  <RotateCw className="h-3 w-3" /> Regenerate
                </button>
                <button
                  onClick={() => {
                    const summary = `${a.headline}\n\n${a.bullets.map((b) => `• ${b.h}: ${b.t}`).join("\n")}\n\nActions:\n${a.actions.map((x) => `- ${x}`).join("\n")}`;
                    navigator.clipboard.writeText(summary);
                    toast.success("Answer copied to clipboard");
                  }}
                  className="inline-flex items-center gap-1 hover:text-foreground transition"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------- Transcript export --------

function exportTranscriptMarkdown(c: Conversation) {
  const lines: string[] = [];
  lines.push(`# CivicPulse Decision Assistant · Transcript`);
  lines.push(`**Session:** ${c.title}`);
  lines.push(`**Started:** ${new Date(c.createdAt).toISOString()}`);
  lines.push(`**Exchanges:** ${c.messages.length}`);
  lines.push("");
  for (const m of c.messages) {
    const ts = new Date(m.ts).toISOString();
    if (m.role === "user") {
      lines.push(`## 🧑 Operator · ${ts}`);
      lines.push(m.text);
      lines.push("");
    } else {
      const a = m.answer;
      lines.push(`## 🤖 CivicPulse AI · ${ts} · ${a.confidence}% confidence`);
      lines.push(`**${a.headline}**`);
      lines.push("");
      for (const b of a.bullets) lines.push(`- **${b.h}:** ${b.t}`);
      lines.push("");
      lines.push(`**Recommended actions:**`);
      for (const act of a.actions) lines.push(`- ${act}`);
      lines.push("");
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `civicpulse-transcript-${c.id}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// -------- Page --------

function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const runGemini = useServerFn(askGemini);
  const { data: liveData, isFetching: liveFetching } = useLiveHotspots();
  const liveContext = useMemo(() => buildAssistantContext(liveData), [liveData]);

  // Bootstrap: idempotent, StrictMode-safe.
  useEffect(() => {
    const stored = loadConversations();
    if (stored.length > 0) {
      setConversations(stored);
      setActiveId(stored[0].id);
    } else {
      const first = newConversation();
      setConversations([first]);
      setActiveId(first.id);
      saveConversations([first]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) saveConversations(conversations); }, [conversations, hydrated]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? conversations[0], [conversations, activeId]);
  const messages = active?.messages ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  function updateActive(fn: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => c.id === activeId ? fn(c) : c));
  }

  async function ask(q: string) {
    if (!q.trim() || busy || !active) return;
    const trimmed = q.trim();
    const uid = "u" + Math.random().toString(36).slice(2, 8);
    const aid = "a" + Math.random().toString(36).slice(2, 8);
    const now = Date.now();

    updateActive((c) => ({
      ...c,
      title: c.messages.length === 0 ? trimmed.slice(0, 48) : c.title,
      messages: [...c.messages, { id: uid, role: "user", text: trimmed, ts: now }],
    }));
    setInput("");
    setBusy(true);

    try {
      const raw = await runGemini({ data: { prompt: trimmed, context: liveContext || undefined } });
      const ans: Answer = { ...raw, actions: raw.actions ?? [] };
      updateActive((c) => ({ ...c, messages: [...c.messages, { id: aid, role: "ai", answer: ans, ts: Date.now(), streaming: true }] }));
      setTimeout(() => {
        updateActive((c) => ({ ...c, messages: c.messages.map((m) => m.id === aid && m.role === "ai" ? { ...m, streaming: false } : m) }));
        setBusy(false);
      }, 900);
    } catch (err) {
      setBusy(false);
      toast.error("Gemini call failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function regenerate(aiMsgId: string) {
    if (!active || busy) return;
    const idx = active.messages.findIndex((m) => m.id === aiMsgId);
    if (idx < 1) return;
    const prev = active.messages[idx - 1];
    if (prev.role !== "user") return;

    setBusy(true);
    updateActive((c) => ({ ...c, messages: c.messages.map((m) => m.id === aiMsgId && m.role === "ai" ? { ...m, streaming: true } : m) }));

    try {
      const existing = active.messages.find((m) => m.id === aiMsgId);
      const regenCount = existing && existing.role === "ai" ? (existing.regenerated ?? 0) + 1 : 1;
      const raw = await runGemini({ data: { prompt: prev.text, context: liveContext || undefined } });
      const ans: Answer = { ...raw, actions: raw.actions ?? [] };
      updateActive((c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === aiMsgId && m.role === "ai"
            ? { ...m, answer: ans, streaming: true, regenerated: regenCount, ts: Date.now() }
            : m
        ),
      }));
      setTimeout(() => {
        updateActive((c) => ({ ...c, messages: c.messages.map((m) => m.id === aiMsgId && m.role === "ai" ? { ...m, streaming: false } : m) }));
        setBusy(false);
        toast.success("Answer regenerated", { description: "Gemini reran the reasoning trace with fresh sampling.", duration: 2400 });
      }, 800);
    } catch (err) {
      setBusy(false);
      toast.error("Gemini regenerate failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  function startNew() {
    const c = newConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
  }

  function deleteConv(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = newConversation();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
    toast("Session deleted");
  }

  return (
    <AppShell>
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_300px] gap-4">
        {/* Conversation history */}
        <aside className="glass-panel rounded-2xl p-3 h-fit xl:sticky xl:top-24">
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-indigo-neon" /> Sessions</div>
            <button
              onClick={startNew}
              className="text-[10px] px-2 py-1 rounded-md bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground inline-flex items-center gap-1 hover:brightness-110"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <div className="mt-3 max-h-[60vh] xl:max-h-[calc(100vh-14rem)] overflow-y-auto space-y-1">
            {conversations.map((c) => {
              const activeClass = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group rounded-lg px-2.5 py-2 border transition cursor-pointer",
                    activeClass ? "border-indigo-neon/50 bg-indigo-neon/10" : "border-transparent hover:bg-surface-2/60"
                  )}
                  onClick={() => setActiveId(c.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{c.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.messages.length} msg · {new Date(c.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                      className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-rose-neon"
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main chat */}
        <div className="glass-panel rounded-2xl flex flex-col h-[calc(100vh-11rem)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 flex-wrap">
            <Radio className="h-4 w-4 text-teal-neon pulse-dot" />
            <div className="text-sm font-semibold truncate">{active?.title ?? "Session"}</div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-neon/15 text-indigo-neon border border-indigo-neon/30">Gemini 1.5 Pro · civic-tuned</span>
            <button
              onClick={() => {
                if (!active) return;
                exportTranscriptMarkdown(active);
                toast.success("Transcript exported", {
                  description: `${active.messages.length} messages · civicpulse-transcript-${active.id}.md`,
                  duration: 3000,
                });
              }}
              disabled={!active || active.messages.length === 0}
              className="ml-auto text-[11px] px-2.5 py-1 rounded-md border border-border hover:bg-surface-2 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Download className="h-3 w-3" /> Export .md
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {messages.length === 0 && (
              <div className="grid place-items-center h-full text-center">
                <div className="max-w-md">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-neon to-teal-neon grid place-items-center">
                    <Sparkles className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="mt-4 text-xl font-semibold tracking-tight">Ask anything about your city</div>
                  <div className="mt-1 text-sm text-muted-foreground">CivicPulse fuses 42 live data layers with Gemini to surface decisions, not just dashboards. Try a prompt on the right, or type your own.</div>
                </div>
              </div>
            )}
            {messages.map((m) => (
              m.role === "user" ? (
                <div key={m.id} className="flex items-start gap-3 justify-end animate-rise">
                  <div className="max-w-2xl rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm">{m.text}</div>
                  <div className="h-8 w-8 rounded-full bg-surface-3 grid place-items-center shrink-0"><User className="h-4 w-4" /></div>
                </div>
              ) : (
                <AnswerCard key={m.id} m={m} onRegenerate={() => regenerate(m.id)} />
              )
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <AiThinkingSkeleton />
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-4 py-3">
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 rounded-xl border border-border bg-surface-1/60 px-3 py-2 focus-within:neon-ring-indigo transition">
              <Sparkles className="h-4 w-4 text-indigo-neon shrink-0" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask CivicPulse anything — 'How's Ward 3 trending?'"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <button type="submit" disabled={!input.trim() || busy} className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-r from-indigo-neon to-teal-neon text-primary-foreground disabled:opacity-40 hover:brightness-110 transition">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Quick actions & context */}
        <aside className="glass-panel rounded-2xl p-5 h-fit">
          <div className="text-sm font-semibold">Quick actions</div>
          <div className="text-[11px] text-muted-foreground">Curated prompts for today's ops</div>
          <div className="mt-4 space-y-2">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => {
                  ask(p);
                  toast.success("Quick prompt sent", { description: p, duration: 2400 });
                }}
                className="group w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border bg-surface-1/60 hover:border-indigo-neon/50 hover:bg-indigo-neon/10 transition flex items-start gap-2"
              >
                <ChevronRight className="h-3.5 w-3.5 text-indigo-neon shrink-0 mt-0.5 group-hover:translate-x-0.5 transition" />
                <span>{p}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface-1/60 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Session context</div>
            <div className="mt-1 text-xs">
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">District</span><span>Metropolitan</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Layers</span><span>Health · Transit · Env · Safety</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Horizon</span><span>72h</span></div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Grounding</span>
                <span className={cn("inline-flex items-center gap-1", liveContext ? "text-emerald-neon" : "text-amber-neon")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", liveContext ? "bg-emerald-neon pulse-dot" : "bg-amber-neon")} />
                  {liveContext ? "Google Maps live" : liveFetching ? "Fetching…" : "Offline"}
                </span>
              </div>
              {liveData && (
                <div className="mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground leading-snug">
                  Feeding Gemini {liveData.metrics.length} ward metrics · AQI · pollen UPI · weather · traffic
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
