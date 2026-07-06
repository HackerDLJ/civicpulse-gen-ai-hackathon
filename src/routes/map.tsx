import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/pulse/AppShell";
import CityMapInner from "@/components/pulse/CityMapLeaflet";
import { Globe2, MapPin, Compass } from "lucide-react";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "World Map · CivicPulse" },
      { name: "description", content: "Explore the world map with live traffic, air quality, and CivicPulse hotspots. Pan, zoom, and switch layers freely." },
      { property: "og:title", content: "World Map · CivicPulse" },
      { property: "og:description", content: "Full Google Maps experience with CivicPulse live layers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-indigo-neon" />
              World Map
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Full pan &amp; zoom · switch between map, satellite, and street view · CivicPulse live layers included.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="glass-panel inline-flex items-center gap-1.5 rounded-md px-2.5 py-1">
              <Compass className="h-3 w-3 text-teal-neon" /> Greedy gestures
            </span>
            <span className="glass-panel inline-flex items-center gap-1.5 rounded-md px-2.5 py-1">
              <MapPin className="h-3 w-3 text-amber-neon" /> Zoom 2 – 20
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-3 sm:p-4">
          <CityMapInner worldView heightClass="h-[calc(100vh-14rem)] min-h-[520px]" />
        </div>
      </div>
    </AppShell>
  );
}
