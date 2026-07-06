// Live Google Maps Platform data via connector gateway.
// Pulls Air Quality (env), Pollen (health), and Weather (env) for a handful
// of Bengaluru focal points and returns them shaped as CityMap hotspots.
import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

type LayerKey = "traffic" | "environment" | "health";
type Color = "rose" | "amber" | "teal" | "indigo" | "emerald";
type Severity = "Critical" | "High" | "Medium" | "Low" | "Nominal";

export type LiveHotspot = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  layer: LayerKey;
  color: Color;
  title: string;
  sector: string;
  metric: string;
  value: string;
  severity: Severity;
  detail: string;
};

// Focal points around Bengaluru — real coords, named sectors.
const POINTS = [
  { id: "downtown",  sector: "Downtown",       lat: 12.9716, lng: 77.5946 },
  { id: "sectorB",   sector: "Sector B",       lat: 12.998,  lng: 77.560  },
  { id: "ringrd",    sector: "Ring Rd E-14",   lat: 12.985,  lng: 77.640  },
  { id: "ward7",     sector: "Ward 7",         lat: 12.945,  lng: 77.680  },
  { id: "riverside", sector: "Riverside",      lat: 12.996,  lng: 77.700  },
  { id: "ward3",     sector: "Ward 3",         lat: 12.955,  lng: 77.540  },
];

function headers() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmKey) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gmKey,
    "Content-Type": "application/json",
  };
}

// ---------- AQI ----------
function aqiSeverity(aqi: number): { sev: Severity; color: Color } {
  if (aqi >= 150) return { sev: "Critical", color: "rose" };
  if (aqi >= 100) return { sev: "High",     color: "amber" };
  if (aqi >= 60)  return { sev: "Medium",   color: "teal" };
  if (aqi >= 30)  return { sev: "Low",      color: "indigo" };
  return           { sev: "Nominal",  color: "emerald" };
}

async function fetchAirQuality(p: typeof POINTS[number]): Promise<LiveHotspot | null> {
  const r = await fetch(`${GATEWAY}/airquality/v1/currentConditions:lookup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      location: { latitude: p.lat, longitude: p.lng },
      extraComputations: ["DOMINANT_POLLUTANT_CONCENTRATION", "HEALTH_RECOMMENDATIONS"],
      languageCode: "en",
    }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const idx = j?.indexes?.[0];
  if (!idx) return null;
  const aqi = Number(idx.aqi ?? 0);
  const { sev, color } = aqiSeverity(aqi);
  const dominant = idx.dominantPollutant ?? "pollutant";
  const rec = j?.healthRecommendations?.generalPopulation ?? idx.category ?? "Air quality reading available.";
  return {
    id: `aq-${p.id}`,
    lat: p.lat, lng: p.lng,
    radius: 18 + Math.min(12, Math.round(aqi / 12)),
    layer: "environment",
    color,
    title: `Air quality · ${idx.category ?? "Reading"}`,
    sector: p.sector,
    metric: `${(idx.displayName ?? "AQI").toString()} (${dominant})`,
    value: String(aqi),
    severity: sev,
    detail: typeof rec === "string" ? rec.slice(0, 220) : String(rec).slice(0, 220),
  };
}

// ---------- Pollen ----------
async function fetchPollen(p: typeof POINTS[number]): Promise<LiveHotspot | null> {
  const url = `${GATEWAY}/pollen/v1/forecast:lookup?location.latitude=${p.lat}&location.longitude=${p.lng}&days=1`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) return null;
  const j = await r.json();
  const day = j?.dailyInfo?.[0];
  const pollens: Array<{ code?: string; displayName?: string; indexInfo?: { value?: number; category?: string } }> = day?.pollenTypeInfo ?? [];
  if (!pollens.length) return null;
  const top = pollens.reduce((a, b) => ((b.indexInfo?.value ?? 0) > (a.indexInfo?.value ?? 0) ? b : a), pollens[0]);
  const v = Number(top.indexInfo?.value ?? 0);
  const sev: Severity = v >= 4 ? "Critical" : v >= 3 ? "High" : v >= 2 ? "Medium" : v >= 1 ? "Low" : "Nominal";
  const color: Color = v >= 4 ? "rose" : v >= 3 ? "amber" : v >= 2 ? "teal" : v >= 1 ? "indigo" : "emerald";
  return {
    id: `pl-${p.id}`,
    lat: p.lat + 0.006, lng: p.lng + 0.004,
    radius: 14 + v * 3,
    layer: "health",
    color,
    title: `Pollen · ${top.displayName ?? "Mix"}`,
    sector: p.sector,
    metric: "UPI (0–5)",
    value: String(v),
    severity: sev,
    detail: top.indexInfo?.category ? `Category: ${top.indexInfo.category}. Advise sensitive residents to limit outdoor exposure.` : "Pollen forecast available for this ward.",
  };
}

// ---------- Weather ----------
async function fetchWeather(p: typeof POINTS[number]): Promise<LiveHotspot | null> {
  const url = `${GATEWAY}/weather/v1/currentConditions:lookup?location.latitude=${p.lat}&location.longitude=${p.lng}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) return null;
  const j = await r.json();
  const tempC: number | undefined = j?.temperature?.degrees;
  const feels: number | undefined = j?.feelsLikeTemperature?.degrees;
  const cond: string | undefined = j?.weatherCondition?.description?.text;
  if (typeof tempC !== "number") return null;
  // Baseline heat concern: >32°C = high, >36 critical.
  const t = tempC;
  const sev: Severity = t >= 36 ? "Critical" : t >= 32 ? "High" : t >= 28 ? "Medium" : t >= 20 ? "Low" : "Nominal";
  const color: Color = t >= 36 ? "rose" : t >= 32 ? "amber" : t >= 28 ? "teal" : t >= 20 ? "indigo" : "emerald";
  return {
    id: `wx-${p.id}`,
    lat: p.lat - 0.005, lng: p.lng - 0.006,
    radius: 16 + Math.max(0, Math.round((t - 20) * 0.8)),
    layer: "environment",
    color,
    title: `Heat · ${cond ?? "Current"}`,
    sector: p.sector,
    metric: "Surface temp",
    value: `${t.toFixed(1)}°C`,
    severity: sev,
    detail: `${cond ?? "Live weather"}. Feels like ${typeof feels === "number" ? feels.toFixed(1) : "—"}°C. Monitor heat-vulnerable populations.`,
  };
}

export const getLiveHotspots = createServerFn({ method: "GET" }).handler(async () => {
  const tasks: Promise<LiveHotspot | null>[] = [];
  for (const p of POINTS) {
    tasks.push(fetchAirQuality(p));
    tasks.push(fetchPollen(p));
    tasks.push(fetchWeather(p));
  }
  const settled = await Promise.allSettled(tasks);
  const hotspots: LiveHotspot[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) hotspots.push(s.value);
  }
  return {
    hotspots,
    fetchedAt: new Date().toISOString(),
    source: "Google Maps Platform · Air Quality + Pollen + Weather",
  };
});
