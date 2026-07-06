import { useEffect, useState, type ReactNode } from "react";
import { Bell, Command, HelpCircle, Menu, Search, X, Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { Onboarding } from "./Onboarding";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/civicpulse-logo.svg.asset.json";

const titles: Record<string, { title: string; sub: string }> = {
  "/": { title: "Operations Dashboard", sub: "Real-time city vitals · fused telemetry + citizen signal" },
  "/alerts": { title: "Live Alerts & Anomaly Detection", sub: "AI-flagged deviations across health, transit, environment" },
  "/analytics": { title: "Data Analytics", sub: "Deep dives on trends, forecasts, and cross-sector correlations" },
  "/feedback": { title: "Community Intelligence Hub", sub: "Unstructured citizen signal, transformed into action" },
  "/assistant": { title: "AI Decision Assistant", sub: "Ask anything · Gemini-powered municipal reasoning" },
};

const mobileNav: Array<{ to: string; label: string; icon: typeof Activity; exact?: boolean; hint: string }> = [
  { to: "/", label: "Dashboard", icon: Activity, exact: true, hint: "Real-time city vitals" },
  { to: "/alerts", label: "Live Alerts", icon: AlertTriangle, hint: "AI-flagged anomalies" },
  { to: "/analytics", label: "Data Analytics", icon: BarChart3, hint: "Forecasts & trends" },
  { to: "/feedback", label: "Community Feedback", icon: MessageSquareText, hint: "Citizen sentiment" },
  { to: "/assistant", label: "AI Decision Assistant", icon: Sparkles, hint: "Gemini reasoning" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const meta = titles[pathname] ?? titles["/"];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowUtc, setNowUtc] = useState<string>("--:--");
  useEffect(() => {
    const tick = () => setNowUtc(new Date().toISOString().slice(11, 16));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-close drawer on route change.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          {/* Subtle brand accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-indigo-neon/60 to-transparent" />
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-8 h-14 sm:h-16">
            {/* Mobile menu button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden h-9 w-9 grid place-items-center rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 transition shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile brand mark (sidebar hidden on mobile) */}
            <Link to="/hero" className="lg:hidden flex items-center gap-2 shrink-0" aria-label="CivicPulse home">
              <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-neon to-teal-neon">
                <img src={logoAsset.url} alt="" className="h-4 w-4 [filter:brightness(0)_invert(1)]" />
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" />
              </div>
              <span className="text-sm font-semibold tracking-tight hidden xs:inline">CivicPulse</span>
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" />
                <span className="hidden xs:inline">Live</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular-nums">UTC {nowUtc}</span>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight truncate">{meta.title}</h1>
              <p className="text-xs text-muted-foreground truncate hidden md:block">{meta.sub}</p>
            </div>

            {/* Desktop search */}
            <div className="hidden xl:flex items-center gap-2 rounded-lg border border-border bg-surface-1/60 hover:border-indigo-neon/40 hover:bg-surface-2 transition px-3 py-1.5 text-xs text-muted-foreground w-72 shrink-0">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 truncate">Search sensors, wards, alerts…</span>
              <kbd className="inline-flex items-center gap-0.5 text-[10px] rounded bg-surface-3 px-1.5 py-0.5"><Command className="h-3 w-3" />K</kbd>
            </div>

            <Link
              to="/hero"
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 hover:text-foreground transition text-[11px] text-muted-foreground shrink-0"
              aria-label="About CivicPulse"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-neon" /> Intro
            </Link>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent("civicpulse:onboarding"))}
              className="hidden md:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 transition text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Replay walkthrough"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Tour
            </button>

            <Link
              to="/alerts"
              className="relative grid place-items-center h-9 w-9 rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 hover:border-rose-neon/40 transition shrink-0"
              aria-label="Live alerts"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-neon pulse-dot" />
            </Link>

            <div className="hidden sm:flex items-center gap-2 pl-2 sm:pl-3 ml-0 sm:ml-1 border-l border-border shrink-0">
              <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-indigo-neon to-teal-neon grid place-items-center text-[11px] font-semibold text-primary-foreground ring-2 ring-background">
                MK
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-neon ring-2 ring-background" />
              </div>
              <div className="hidden md:block text-xs leading-tight">
                <div className="font-medium">M. Kaur</div>
                <div className="text-muted-foreground">City Ops · L4</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 animate-rise">{children}</main>
      </div>

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] animate-rise" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[82%] max-w-[300px] bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl">
            <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
              <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon shrink-0">
                <img src={logoAsset.url} alt="" className="h-5 w-5 [filter:brightness(0)_invert(1)]" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight">CivicPulse</div>
                <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">City Intelligence</div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="px-3 flex flex-col gap-1 overflow-y-auto">
              <div className="px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70">Operations</div>
              {mobileNav.map((n) => {
                const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setDrawerOpen(false)}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg pl-3.5 pr-3 py-2.5 text-sm transition-all",
                      active
                        ? "bg-gradient-to-r from-indigo-neon/20 via-indigo-neon/10 to-transparent text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {/* Active left indicator */}
                    <span
                      className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all",
                        active ? "bg-gradient-to-b from-indigo-neon to-teal-neon opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      className={cn(
                        "grid place-items-center h-8 w-8 rounded-md transition-colors shrink-0",
                        active
                          ? "bg-indigo-neon/15 text-indigo-neon"
                          : "bg-sidebar-accent/40 text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn("block truncate leading-tight", active && "font-medium")}>{n.label}</span>
                      <span className="block text-[10.5px] text-muted-foreground/70 truncate leading-tight mt-0.5">{n.hint}</span>
                    </span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-neon pulse-dot shrink-0" />}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto p-4">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  window.dispatchEvent(new CustomEvent("civicpulse:onboarding"));
                }}
                className="w-full text-[11px] px-3 py-2 rounded-lg border border-indigo-neon/40 text-indigo-neon hover:bg-indigo-neon/10 inline-flex items-center justify-center gap-1.5 transition"
              >
                <HelpCircle className="h-3.5 w-3.5" /> Replay walkthrough
              </button>
              <div className="mt-3 glass-panel rounded-xl p-3 text-[11px] text-muted-foreground leading-relaxed">
                <div className="flex items-center gap-2 text-emerald-neon font-medium mb-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-neon pulse-dot" /> All systems nominal
                </div>
                Gemini v3.4 · 214 sensor nodes
              </div>
            </div>
          </aside>
        </div>
      )}

      <Onboarding />
    </div>
  );
}
