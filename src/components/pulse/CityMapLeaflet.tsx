/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Car, Wind, HeartPulse, Layers, MapPin, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveHotspots } from "@/lib/google-maps.functions";

// ---------- Types ----------
export type LayerKey = "traffic" | "environment" | "health";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  layer: LayerKey;
  color: "rose" | "amber" | "teal" | "indigo" | "emerald";
  title: string;
  sector: string;
  metric: string;
  value: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Nominal";
  detail: string;
};

const CENTER = { lat: 12.9716, lng: 77.5946 };
const ZOOM = 12;

// Hotspots now come live from Google Maps Platform (Air Quality + Pollen +
// Weather) via getLiveHotspots(). Traffic uses Google's TrafficLayer overlay.

const layerMeta: Record<LayerKey, { label: string; icon: typeof Car; ring: string; tone: string }> = {
  traffic:     { label: "Traffic",     icon: Car,        ring: "border-amber-neon/50 bg-amber-neon/10 text-amber-neon", tone: "text-amber-neon" },
  environment: { label: "Environment", icon: Wind,       ring: "border-teal-neon/50 bg-teal-neon/10 text-teal-neon",    tone: "text-teal-neon" },
  health:      { label: "Health",      icon: HeartPulse, ring: "border-rose-neon/50 bg-rose-neon/10 text-rose-neon",    tone: "text-rose-neon" },
};

const colorHex: Record<Hotspot["color"], string> = {
  rose: "#fb7185", amber: "#fbbf24", teal: "#2dd4bf", indigo: "#818cf8", emerald: "#34d399",
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

// Dark map styling matching CivicPulse's slate palette.
const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a2035" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a92b2" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#a8b2d1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3350" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7599" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a4670" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1629" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5578" }] },
];

// Global loader — Google Maps JS must load exactly once per page.
let mapsLoader: Promise<typeof google.maps> | null = null;
function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (mapsLoader) return mapsLoader;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Missing Google Maps browser key"));

  mapsLoader = new Promise((resolve, reject) => {
    const cbName = "__civicpulseInitGMaps";
    (window as any)[cbName] = () => resolve((window as any).google.maps);
    const s = document.createElement("script");
    const params = new URLSearchParams({ key, loading: "async", callback: cbName });
    if (channel) params.set("channel", channel);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

export default function CityMapInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ traffic: true, environment: true, health: true });
  const [hover, setHover] = useState<Hotspot | null>(null);
  const [pinned, setPinned] = useState<Hotspot | null>(null);

  const fetchLive = useServerFn(getLiveHotspots);
  const { data, isLoading, isFetching, refetch, error: liveError } = useQuery({
    queryKey: ["live-hotspots"],
    queryFn: () => fetchLive(),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    staleTime: 60 * 1000,
  });
  const allHotspots: Hotspot[] = (data?.hotspots as Hotspot[] | undefined) ?? [];

  const visible = useMemo(() => allHotspots.filter((h) => layers[h.layer]), [allHotspots, layers]);
  const activeCount = Object.values(layers).filter(Boolean).length;
  const focused = pinned ?? hover;

  // Load map once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center: CENTER,
          zoom: ZOOM,
          minZoom: 11,
          maxZoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: "cooperative",
          styles: darkMapStyles,
          backgroundColor: "#1a2035",
          restriction: {
            latLngBounds: { north: 13.08, south: 12.86, east: 77.72, west: 77.46 },
            strictBounds: false,
          },
        });
        setReady(true);
      })
      .catch((e) => setError(e.message ?? "Map failed to load"));
    return () => { cancelled = true; };
  }, []);

  // Sync markers whenever visibility or focus changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps as typeof google.maps;

    // Remove markers no longer visible.
    for (const id of Object.keys(markersRef.current)) {
      if (!visible.find((h) => h.id === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    }

    for (const h of visible) {
      const active = focused?.id === h.id;
      const scale = (active ? h.radius * 0.7 : h.radius * 0.55) * 0.6;
      const color = colorHex[h.color];
      const icon: google.maps.Symbol = {
        path: maps.SymbolPath.CIRCLE,
        scale,
        fillColor: color,
        fillOpacity: active ? 0.5 : 0.32,
        strokeColor: color,
        strokeOpacity: 0.95,
        strokeWeight: active ? 3 : 1.5,
      };
      let m = markersRef.current[h.id];
      if (!m) {
        m = new maps.Marker({ position: { lat: h.lat, lng: h.lng }, map, title: `${h.title} · ${h.sector}`, icon });
        m.addListener("mouseover", () => setHover(h));
        m.addListener("mouseout", () => setHover(null));
        m.addListener("click", () => setPinned((p) => (p?.id === h.id ? null : h)));
        markersRef.current[h.id] = m;
      } else {
        m.setIcon(icon);
      }
    }
  }, [visible, focused]);

  // Toggle Google's live TrafficLayer with the "traffic" layer button.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !(window as any).google?.maps) return;
    const maps = (window as any).google.maps as typeof google.maps;
    if (layers.traffic) {
      if (!trafficRef.current) trafficRef.current = new maps.TrafficLayer();
      trafficRef.current.setMap(map);
    } else if (trafficRef.current) {
      trafficRef.current.setMap(null);
    }
  }, [layers.traffic, ready]);

  return (
    <div>
      {/* Layer toggles */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {(Object.keys(layerMeta) as LayerKey[]).map((k) => {
          const m = layerMeta[k];
          const on = layers[k];
          const count = allHotspots.filter((h) => h.layer === k).length;
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
        <div ref={containerRef} className="h-full w-full" />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading map…</div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-neon px-6 text-center">{error}</div>
        )}

        {/* Overlay: header chips */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-indigo-neon" /> Metropolitan District · Google Maps
        </div>
        <div className="absolute right-3 top-3 z-[400] flex items-center gap-1.5">
          <div className="glass-panel rounded-lg px-2.5 py-1.5 text-[10px] flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-teal-neon" /> {activeCount} layer{activeCount === 1 ? "" : "s"} · {visible.length} live
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="glass-panel rounded-lg px-2 py-1.5 text-[10px] flex items-center gap-1 hover:text-teal-neon transition disabled:opacity-60"
            aria-label="Refresh live data"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
          </button>
        </div>

        {isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-[400] flex justify-center">
            <div className="glass-panel rounded-full px-3 py-1 text-[10px] text-muted-foreground">Fetching live Google Maps data…</div>
          </div>
        )}
        {liveError && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-[400] flex justify-center">
            <div className="glass-panel rounded-full px-3 py-1 text-[10px] text-rose-neon">Live data unavailable</div>
          </div>
        )}
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
