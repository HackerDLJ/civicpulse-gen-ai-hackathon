import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, AlertTriangle, BarChart3, MessageSquareText, Sparkles, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: Activity, exact: true },
  { to: "/alerts", label: "Live Alerts", icon: AlertTriangle },
  { to: "/analytics", label: "Data Analytics", icon: BarChart3 },
  { to: "/feedback", label: "Community Feedback", icon: MessageSquareText },
  { to: "/assistant", label: "AI Decision Assistant", icon: Sparkles },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-sidebar-border bg-sidebar/60 backdrop-blur-xl">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-neon to-teal-neon">
            <Radio className="h-4.5 w-4.5 text-primary-foreground" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">CivicPulse</div>
            <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">City Intelligence</div>
          </div>
        </div>
      </div>

      <nav className="px-3 flex flex-col gap-0.5">
        <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">Operations</div>
        {nav.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-indigo-neon/20 to-teal-neon/10 text-foreground neon-ring-indigo"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-indigo-neon" : "")} />
              <span className="truncate">{n.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-neon pulse-dot" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-neon pulse-dot" />
            <span className="text-emerald-neon font-medium">All systems nominal</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            Gemini decision engine <span className="text-foreground">v3.4</span> — synced 4s ago across 214 sensor nodes.
          </div>
        </div>
      </div>
    </aside>
  );
}
