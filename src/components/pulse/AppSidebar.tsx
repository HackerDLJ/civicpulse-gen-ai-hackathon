import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles, Radio,
  ChevronsLeft, ChevronsRight, LayoutGrid,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const nav: Array<{ to: string; label: string; icon: typeof Activity; exact?: boolean; hint: string }> = [
  { to: "/", label: "Dashboard", icon: Activity, exact: true, hint: "Real-time city vitals" },
  { to: "/alerts", label: "Live Alerts", icon: AlertTriangle, hint: "AI-flagged anomalies" },
  { to: "/analytics", label: "Data Analytics", icon: BarChart3, hint: "Forecasts & trends" },
  { to: "/feedback", label: "Community Feedback", icon: MessageSquareText, hint: "Citizen sentiment" },
  { to: "/assistant", label: "AI Decision Assistant", icon: Sparkles, hint: "Gemini reasoning" },
];

const KEY = "civicpulse.sidebar.collapsed.v1";

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate persisted state.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "1") setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar/60 backdrop-blur-xl transition-[width] duration-300 ease-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
      aria-label="Primary navigation"
    >
      {/* Brand + collapse toggle */}
      <div className={cn("pt-6 pb-5", collapsed ? "px-2" : "px-5")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon shrink-0">
            <Radio className="h-4.5 w-4.5 text-primary-foreground" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold tracking-tight">CivicPulse</div>
              <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">City Intelligence</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggle}
              className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={toggle}
            className="mt-4 mx-auto h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition"
            aria-label="Show all options"
            title="Show all options"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className={cn("flex flex-col gap-0.5", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">Operations</div>
        )}
        {nav.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              title={collapsed ? `${n.label} — ${n.hint}` : undefined}
              aria-label={n.label}
              className={cn(
                "group relative flex items-center rounded-lg text-sm transition-all",
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                active
                  ? "bg-gradient-to-r from-indigo-neon/20 to-teal-neon/10 text-foreground neon-ring-indigo"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-indigo-neon")} />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-neon pulse-dot" />}
              {collapsed && active && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-neon pulse-dot" />
              )}
            </Link>
          );
        })}

        {collapsed && (
          <button
            onClick={toggle}
            className="mt-3 mx-auto text-[10px] uppercase tracking-widest text-muted-foreground hover:text-indigo-neon inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-sidebar-accent/60 transition"
            title="Show all options"
          >
            <LayoutGrid className="h-3 w-3" />
          </button>
        )}
      </nav>

      <div className="mt-auto p-4">
        {collapsed ? (
          <div className="grid place-items-center" title="All systems nominal · Gemini v3.4">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-neon pulse-dot" />
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
              <span className="text-emerald-neon font-medium">All systems nominal</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
              Gemini decision engine <span className="text-foreground">v3.4</span> — synced 4s ago across 214 sensor nodes.
            </div>
            <button
              onClick={toggle}
              className="mt-3 w-full text-[11px] px-2 py-1.5 rounded-md border border-border hover:bg-sidebar-accent/60 inline-flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition"
            >
              <ChevronsLeft className="h-3 w-3" /> Collapse sidebar
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
