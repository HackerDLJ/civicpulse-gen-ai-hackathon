import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, LayerGroup, ZoomControl } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import { Car, Wind, HeartPulse, Layers, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Types ----------
export type LayerKey = "traffic" | "environment" | "health";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  radius: number; // display radius in px
  layer: LayerKey;
  color: "rose" | "amber" | "teal" | "indigo" | "emerald";
  title: string;
  sector: string;
  metric: string;
  value: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Nominal";
  detail: string;
};

// Metropolitan center — Bengaluru chosen as a realistic dense urban demo.
// Swap coords if the user wants a different city; markers are relative.
const CENTER: LatLngExpression = [12.9716, 77.5946];
const ZOOM = 12;

// Bounds keep the tile view scoped even if the user scrolls out.
const BOUNDS: LatLngBoundsExpression = [
  [12.86, 77.46],
  [13.08, 77.72],
];

// ---------- Realistic hotspot payload (lat/lng around CENTER) ----------
const hotspots: Hotspot[] = [
  { id: "h1", lat: 12.998, lng: 77.560, radius: 26, layer: "health", color: "rose",   title: "Respiratory cluster",    sector: "Sector B",         metric: "Admissions Δ",   value: "+22% / 6h", severity: "Critical", detail: "PM2.5 plume trapping under inversion layer. 340 walk-ins projected tonight." },
  { id: "h2", lat: 12.985, lng: 77.640, radius: 22, layer: "traffic", color: "amber", title: "Ring Rd E-14 congestion", sector: "Ring Rd E-14",     metric: "Flow saturation", value: "92%",       severity: "High",     detail: "Signal desync + freight overlap. Cascade risk in 40 min." },
  { id: "h3", lat: 12.945, lng: 77.680, radius: 18, layer: "environment", color: "teal", title: "Water pressure anomaly", sector: "Ward 7",       metric: "Δ baseline",      value: "-0.7 bar",  severity: "Medium",   detail: "Substation drift. No leak signature yet — monitor 2h." },
  { id: "h4", lat: 12.938, lng: 77.605, radius: 24, layer: "environment", color: "rose", title: "Heat island",           sector: "Downtown",        metric: "Surface temp Δ",  value: "+2.4°C",    severity: "High",     detail: "Grid trending above forecast. Cooling center readiness advised." },
  { id: "h5", lat: 12.972, lng: 77.594, radius: 16, layer: "traffic", color: "indigo", title: "Crowd density surge",   sector: "Central Plaza",   metric: "Est. count",      value: "8,120",     severity: "Medium",   detail: "Approaching safety threshold. Deploy stewards within 25 min." },
  { id: "h6", lat: 12.996, lng: 77.700, radius: 16, layer: "health", color: "emerald",title: "Riverside · nominal",    sector: "Riverside",       metric: "Clinic load",     value: "48%",       severity: "Nominal",  detail: "All indicators within baseline. No action required." },
  { id: "h7", lat: 12.955, lng: 77.540, radius: 18, layer: "health", color: "amber",  title: "Clinic capacity strain", sector: "Ward 3",          metric: "Utilization",     value: "92%",       severity: "High",     detail: "Overflow risk within 90 min at current arrival rate." },
  { id: "h8", lat: 12.918, lng: 77.635, radius: 14, layer: "traffic", color: "teal",  title: "NR-9 spillback",         sector: "NR-9 / 4th Ave",  metric: "Queue length",    value: "310m",      severity: "Medium",   detail: "Left-turn cascade every ~14 min. Retiming candidate." },
];

const layerMeta: Record<LayerKey, { label: string; icon: typeof Car; ring: string; tone: string }> = {
  traffic:     { label: "Traffic",     icon: Car,        ring: "border-amber-neon/50 bg-amber-neon/10 text-amber-neon", tone: "text-amber-neon" },
  environment: { label: "Environment", icon: Wind,       ring: "border-teal-neon/50 bg-teal-neon/10 text-teal-neon",    tone: "text-teal-neon" },
  health:      { label: "Health",      icon: HeartPulse, ring: "border-rose-neon/50 bg-rose-neon/10 text-rose-neon",    tone: "text-rose-neon" },
};

const colorVar: Record<Hotspot["color"], string> = {
  rose: "var(--rose-neon)", amber: "var(--amber-neon)", teal: "var(--teal-neon)", indigo: "var(--indigo-neon)", emerald: "var(--emerald-neon)",
};

const sevTone: Record<Hotspot["severity"], string> = {
  Critical: "text-rose-neon",
  High:     "text-amber-neon",
  Medium:   "text-teal-neon",
  Low:      "text-indigo-neon",
  Nominal:  "text-emerald-neon",
};

/**
 * OSM-backed city map. Uses CartoDB Dark Matter tiles for a look that matches
 * CivicPulse's slate palette; base attribution kept intact per OSM policy.
 */
export function CityMap() {
  const [mounted, setMounted] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ traffic: true, environment: true, health: true });
  const [hover, setHover] = useState<Hotspot | null>(null);
  const [pinned, setPinned] = useState<Hotspot | null>(null);

  // react-leaflet touches window on import; only render post-mount to avoid SSR crash.
  useEffect(() => { setMounted(true); }, []);

  const visible = useMemo(() => hotspots.filter((h) => layers[h.layer]), [layers]);
  const activeCount = Object.values(layers).filter(Boolean).length;
  const focused = pinned ?? hover;

  return (
    <div>
      {/* Layer toggles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {(Object.keys(layerMeta) as LayerKey[]).map((k) => {
          const m = layerMeta[k];
          const on = layers[k];
          const count = hotspots.filter((h) => h.layer === k).length;
          const Icon = m.icon;
          return (
            <button
              key={k}
              onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-md border transition inline-flex items-center gap-1.5",
                on ? m.ring : "border-border text-muted-foreground hover:text-foreground opacity-60"
              )}
              aria-pressed={on}
            >
              <Icon className="h-3 w-3" />
              {m.label}
              <span className={cn("text-[10px] px-1 rounded", on ? "bg-background/40" : "bg-surface-2")}>{count}</span>
            </button>
          );
        })}
        <button
          onClick={() => setLayers({ traffic: true, environment: true, health: true })}
          className="text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition"
        >
          Reset
        </button>
      </div>

      <div className="relative aspect-[16/10] sm:aspect-[16/9] xl:aspect-[16/10] w-full rounded-xl border border-border overflow-hidden bg-surface-1">
        {mounted && (
          <MapContainer
            center={CENTER}
            zoom={ZOOM}
            minZoom={11}
            maxZoom={17}
            maxBounds={BOUNDS}
            zoomControl={false}
            attributionControl
            scrollWheelZoom={false}
            className="h-full w-full civicpulse-leaflet"
            style={{ background: "oklch(0.18 0.02 260)" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
            />
            <ZoomControl position="bottomright" />

            <LayerGroup>
              {visible.map((h) => {
                const active = focused?.id === h.id;
                const color = colorVar[h.color];
                return (
                  <CircleMarker
                    key={h.id}
                    center={[h.lat, h.lng]}
                    radius={active ? h.radius * 0.7 : h.radius * 0.55}
                    pathOptions={{
                      color,
                      weight: active ? 3 : 1.5,
                      opacity: 0.95,
                      fillColor: color,
                      fillOpacity: active ? 0.45 : 0.28,
                      className: "civicpulse-marker",
                    }}
                    eventHandlers={{
                      mouseover: () => setHover(h),
                      mouseout: () => setHover(null),
                      click: () => setPinned(pinned?.id === h.id ? null : h),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1} className="civicpulse-tooltip">
                      <span className="font-semibold">{h.title}</span>
                      <span className="opacity-70"> · {h.sector}</span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </MapContainer>
        )}

        {/* Overlay: header chips */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-indigo-neon" /> Metropolitan District · OSM
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-[400] glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-teal-neon" /> {activeCount} layer{activeCount === 1 ? "" : "s"} · {visible.length} hotspots
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute left-3 bottom-8 sm:bottom-3 z-[400] glass-panel rounded-lg px-3 py-2 text-[10px] flex flex-wrap gap-3 max-w-[calc(100%-1.5rem)]">
          {[
            { c: "rose", l: "Critical" },
            { c: "amber", l: "High" },
            { c: "teal", l: "Medium" },
            { c: "indigo", l: "Safety" },
            { c: "emerald", l: "Nominal" },
          ].map((x) => (
            <span key={x.l} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorVar[x.c as Hotspot["color"]] }} />
              {x.l}
            </span>
          ))}
        </div>

        {/* Detail panel */}
        {focused && (
          <div className="absolute right-3 bottom-3 z-[500] w-[min(18rem,calc(100%-1.5rem))] glass-panel rounded-xl p-4 animate-rise">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {(() => { const Icon = layerMeta[focused.layer].icon; return <Icon className={cn("h-3 w-3", layerMeta[focused.layer].tone)} />; })()}
                  <span className="truncate">{layerMeta[focused.layer].label} · {focused.sector}</span>
                </div>
                <div className="mt-0.5 text-sm font-semibold tracking-tight truncate">{focused.title}</div>
              </div>
              {pinned && (
                <button onClick={() => setPinned(null)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Unpin detail">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{focused.metric}</div>
                <div className="text-xl font-semibold">{focused.value}</div>
              </div>
              <div className={cn("ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded border border-current/40 bg-current/10 shrink-0", sevTone[focused.severity])}>
                <span className={sevTone[focused.severity]}>{focused.severity}</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground leading-snug">{focused.detail}</div>
            {!pinned && <div className="mt-2 text-[10px] text-muted-foreground/70">Tap marker to pin details</div>}
          </div>
        )}
      </div>
    </div>
  );
}
