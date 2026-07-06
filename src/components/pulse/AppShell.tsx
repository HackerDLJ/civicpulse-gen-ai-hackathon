import type { ReactNode } from "react";
import { Bell, Command, HelpCircle, Search } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { Onboarding } from "./Onboarding";

const titles: Record<string, { title: string; sub: string }> = {
  "/": { title: "Operations Dashboard", sub: "Real-time city vitals · fused telemetry + citizen signal" },
  "/alerts": { title: "Live Alerts & Anomaly Detection", sub: "AI-flagged deviations across health, transit, environment" },
  "/analytics": { title: "Data Analytics", sub: "Deep dives on trends, forecasts, and cross-sector correlations" },
  "/feedback": { title: "Community Intelligence Hub", sub: "Unstructured citizen signal, transformed into action" },
  "/assistant": { title: "AI Decision Assistant", sub: "Ask anything · Gemini-powered municipal reasoning" },
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const meta = titles[pathname] ?? titles["/"];

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/60 backdrop-blur-xl">
          <div className="flex items-center gap-4 px-4 lg:px-8 h-16">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-neon pulse-dot" />
                Live · UTC {new Date().toISOString().slice(11, 16)}
              </div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{meta.title}</h1>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">{meta.sub}</p>
            </div>

            <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface-1/60 px-3 py-1.5 text-xs text-muted-foreground w-72">
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1">Search sensors, wards, alerts…</span>
              <kbd className="inline-flex items-center gap-0.5 text-[10px] rounded bg-surface-3 px-1.5 py-0.5"><Command className="h-3 w-3" />K</kbd>
            </div>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent("civicpulse:onboarding"))}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 transition text-[11px] text-muted-foreground hover:text-foreground"
              aria-label="Replay walkthrough"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Tour
            </button>

            <Link to="/alerts" className="relative grid place-items-center h-9 w-9 rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2 transition">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-neon pulse-dot" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-neon to-teal-neon grid place-items-center text-[11px] font-semibold text-primary-foreground">MK</div>
              <div className="hidden sm:block text-xs leading-tight">
                <div className="font-medium">M. Kaur</div>
                <div className="text-muted-foreground">City Ops · L4</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 animate-rise">{children}</main>
      </div>
    </div>
  );
}
