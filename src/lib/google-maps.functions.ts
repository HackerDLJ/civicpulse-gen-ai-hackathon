// Live Google Maps Platform data via connector gateway.
// Pulls Air Quality (env), Pollen (health), and Weather (env) for a handful
// of Bengaluru focal points and returns them shaped as CityMap hotspots plus
// per-ward metric snapshots and per-service success/failure status so the UI
// can surface exactly which Google services failed and retry them.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type ServiceStatus = {
  ok: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

export type WardMetrics = {
  sector: string;
  lat: number;
  lng: number;
  aqi?: number;
  aqiCategory?: string;
  dominantPollutant?: string;
  pollenUpi?: number;
  pollenType?: string;
  pollenCategory?: string;
  tempC?: number;
  feelsLikeC?: number;
  weatherCondition?: string;
  trafficRatio?: number;
  trafficDelayPct?: number;
};

export type LiveHotspotsResult = {
  hotspots: LiveHotspot[];
  metrics: WardMetrics[];
  fetchedAt: string;
  source: string;
  services: {
    airQuality: ServiceStatus;
    pollen: ServiceStatus;
    weather: ServiceStatus;
    traffic: ServiceStatus;
  };
};

// Focal points around Bengaluru — real coords, named sectors.
const POINTS = [
  { id: "downtown",  sector: "Downtown",     lat: 12.9716, lng: 77.5946 },
  { id: "sectorB",   sector: "Sector B",     lat: 12.998,  lng: 77.560  },
  { id: "ringrd",    sector: "Ring Rd E-14", lat: 12.985,  lng: 77.640  },
  { id: "ward7",     sector: "Ward 7",       lat: 12.945,  lng: 77.680  },
  { id: "riverside", sector: "Riverside",    lat: 12.996,  lng: 77.700  },
  { id: "ward3",     sector: "Ward 3",       lat: 12.955,  lng: 77.540  },
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

type FetchOutcome = { hotspot?: LiveHotspot; patch?: Partial<WardMetrics>; error?: string };

// ---------- AQI ----------
function aqiSeverity(aqi: number): { sev: Severity; color: Color } {
  if (aqi >= 150) return { sev: "Critical", color: "rose" };
  if (aqi >= 100) return { sev: "High",     color: "amber" };
  if (aqi >= 60)  return { sev: "Medium",   color: "teal" };
  if (aqi >= 30)  return { sev: "Low",      color: "indigo" };
  return           { sev: "Nominal",  color: "emerald" };
}

async function fetchAirQuality(p: typeof POINTS[number]): Promise<FetchOutcome> {
  try {
    const r = await fetch(`${GATEWAY}/airquality/v1/currentConditions:lookup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        location: { latitude: p.lat, longitude: p.lng },
        extraComputations: ["DOMINANT_POLLUTANT_CONCENTRATION", "HEALTH_RECOMMENDATIONS"],
        languageCode: "en",
      }),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    const idx = j?.indexes?.[0];
    if (!idx) return { error: "empty response" };
    const aqi = Number(idx.aqi ?? 0);
    const { sev, color } = aqiSeverity(aqi);
    const dominant = idx.dominantPollutant ?? "pollutant";
    const rec = j?.healthRecommendations?.generalPopulation ?? idx.category ?? "Air quality reading available.";
    return {
      hotspot: {
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
      },
      patch: { aqi, aqiCategory: idx.category, dominantPollutant: dominant },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

// ---------- Pollen ----------
async function fetchPollen(p: typeof POINTS[number]): Promise<FetchOutcome> {
  try {
    const url = `${GATEWAY}/pollen/v1/forecast:lookup?location.latitude=${p.lat}&location.longitude=${p.lng}&days=1`;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    const day = j?.dailyInfo?.[0];
    const pollens: Array<{ code?: string; displayName?: string; indexInfo?: { value?: number; category?: string } }> = day?.pollenTypeInfo ?? [];
    if (!pollens.length) return { error: "no pollen data" };
    const top = pollens.reduce((a, b) => ((b.indexInfo?.value ?? 0) > (a.indexInfo?.value ?? 0) ? b : a), pollens[0]);
    const v = Number(top.indexInfo?.value ?? 0);
    const sev: Severity = v >= 4 ? "Critical" : v >= 3 ? "High" : v >= 2 ? "Medium" : v >= 1 ? "Low" : "Nominal";
    const color: Color = v >= 4 ? "rose" : v >= 3 ? "amber" : v >= 2 ? "teal" : v >= 1 ? "indigo" : "emerald";
    return {
      hotspot: {
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
        detail: top.indexInfo?.category
          ? `Category: ${top.indexInfo.category}. Advise sensitive residents to limit outdoor exposure.`
          : "Pollen forecast available for this ward.",
      },
      patch: { pollenUpi: v, pollenType: top.displayName, pollenCategory: top.indexInfo?.category },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

// ---------- Weather ----------
async function fetchWeather(p: typeof POINTS[number]): Promise<FetchOutcome> {
  try {
    const url = `${GATEWAY}/weather/v1/currentConditions:lookup?location.latitude=${p.lat}&location.longitude=${p.lng}`;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    const tempC: number | undefined = j?.temperature?.degrees;
    const feels: number | undefined = j?.feelsLikeTemperature?.degrees;
    const cond: string | undefined = j?.weatherCondition?.description?.text;
    if (typeof tempC !== "number") return { error: "no temperature" };
    const t = tempC;
    const sev: Severity = t >= 36 ? "Critical" : t >= 32 ? "High" : t >= 28 ? "Medium" : t >= 20 ? "Low" : "Nominal";
    const color: Color = t >= 36 ? "rose" : t >= 32 ? "amber" : t >= 28 ? "teal" : t >= 20 ? "indigo" : "emerald";
    return {
      hotspot: {
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
      },
      patch: { tempC, feelsLikeC: feels, weatherCondition: cond },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

// ---------- Traffic (Routes API — traffic-aware vs static duration) ----------
async function fetchTraffic(p: typeof POINTS[number]): Promise<FetchOutcome> {
  try {
    const origin = { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
    // ~2.5km NE probe from each focal point.
    const destination = { location: { latLng: { latitude: p.lat + 0.02, longitude: p.lng + 0.02 } } };
    const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: { ...headers(), "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters" },
      body: JSON.stringify({
        origin, destination,
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) return { error: "no route" };
    const parseSec = (s: string | undefined) => (typeof s === "string" ? Number(s.replace(/s$/, "")) : NaN);
    const live = parseSec(route.duration);
    const base = parseSec(route.staticDuration);
    if (!isFinite(live) || !isFinite(base) || base <= 0) return { error: "duration missing" };
    const ratio = live / base;
    const pct = Math.round((ratio - 1) * 100);
    const sev: Severity = ratio >= 1.6 ? "Critical" : ratio >= 1.3 ? "High" : ratio >= 1.15 ? "Medium" : ratio >= 1.05 ? "Low" : "Nominal";
    const color: Color = ratio >= 1.6 ? "rose" : ratio >= 1.3 ? "amber" : ratio >= 1.15 ? "teal" : "indigo";
    return {
      hotspot: {
        id: `tr-${p.id}`,
        lat: p.lat + 0.003, lng: p.lng - 0.004,
        radius: 16 + Math.max(0, pct),
        layer: "traffic",
        color,
        title: `Traffic · ${pct >= 0 ? "+" : ""}${pct}% vs free-flow`,
        sector: p.sector,
        metric: "Congestion ratio",
        value: `${ratio.toFixed(2)}×`,
        severity: sev,
        detail: `Live drive ${Math.round(live / 60)} min vs free-flow ${Math.round(base / 60)} min on a 2.5 km probe route from ${p.sector}.`,
      },
      patch: { trafficRatio: ratio, trafficDelayPct: pct },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

function emptyStatus(): ServiceStatus {
  return { ok: true, attempted: 0, succeeded: 0, failed: 0, errors: [] };
}

function recordStatus(s: ServiceStatus, outcome: FetchOutcome, sector: string) {
  s.attempted++;
  if (outcome.error) {
    s.failed++;
    s.ok = false;
    const label = `${sector}: ${outcome.error}`;
    if (s.errors.length < 3) s.errors.push(label);
  } else {
    s.succeeded++;
  }
}

export const getLiveHotspots = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async (): Promise<LiveHotspotsResult> => {
  const airQuality = emptyStatus();
  const pollen = emptyStatus();
  const weather = emptyStatus();
  const traffic = emptyStatus();
  const metricsBySector = new Map<string, WardMetrics>();
  const hotspots: LiveHotspot[] = [];

  const tasks = POINTS.map(async (p) => {
    metricsBySector.set(p.sector, { sector: p.sector, lat: p.lat, lng: p.lng });
    const [aq, pl, wx, tr] = await Promise.all([fetchAirQuality(p), fetchPollen(p), fetchWeather(p), fetchTraffic(p)]);
    recordStatus(airQuality, aq, p.sector);
    recordStatus(pollen, pl, p.sector);
    recordStatus(weather, wx, p.sector);
    recordStatus(traffic, tr, p.sector);
    const m = metricsBySector.get(p.sector)!;
    if (aq.hotspot) hotspots.push(aq.hotspot);
    if (pl.hotspot) hotspots.push(pl.hotspot);
    if (wx.hotspot) hotspots.push(wx.hotspot);
    if (tr.hotspot) hotspots.push(tr.hotspot);
    Object.assign(m, aq.patch ?? {}, pl.patch ?? {}, wx.patch ?? {}, tr.patch ?? {});
  });
  await Promise.all(tasks);

  return {
    hotspots,
    metrics: Array.from(metricsBySector.values()),
    fetchedAt: new Date().toISOString(),
    source: "Google Maps Platform · Air Quality + Pollen + Weather + Routes (traffic)",
    services: { airQuality, pollen, weather, traffic },
  };
});

// ---------- Google Maps Community feedback (Places API New reviews) ----------

export type GoogleCommunityReview = {
  id: string;
  ward: string;
  placeName: string;
  placeId: string;
  author: string;
  authorPhoto?: string;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime?: string;
  sentiment: "Positive" | "Negative" | "Neutral";
};

export type GoogleCommunityFeedbackResult = {
  reviews: GoogleCommunityReview[];
  fetchedAt: string;
  source: string;
  status: ServiceStatus;
};

function sentimentFor(rating: number): GoogleCommunityReview["sentiment"] {
  if (rating >= 4) return "Positive";
  if (rating <= 2) return "Negative";
  return "Neutral";
}

async function fetchWardReviews(p: typeof POINTS[number]): Promise<{ reviews: GoogleCommunityReview[]; error?: string }> {
  try {
    const r = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        ...headers(),
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.reviews",
      },
      body: JSON.stringify({
        maxResultCount: 5,
        rankPreference: "POPULARITY",
        locationRestriction: { circle: { center: { latitude: p.lat, longitude: p.lng }, radius: 1500 } },
      }),
    });
    if (!r.ok) return { reviews: [], error: `HTTP ${r.status}` };
    const j = await r.json();
    const out: GoogleCommunityReview[] = [];
    for (const place of j?.places ?? []) {
      const placeName: string = place?.displayName?.text ?? "Nearby place";
      const placeId: string = place?.id ?? "";
      for (const rev of place?.reviews ?? []) {
        const rating = Number(rev?.rating ?? 0);
        const text: string = rev?.text?.text ?? rev?.originalText?.text ?? "";
        if (!text) continue;
        out.push({
          id: `gr-${placeId}-${out.length}`,
          ward: p.sector,
          placeName,
          placeId,
          author: rev?.authorAttribution?.displayName ?? "Google user",
          authorPhoto: rev?.authorAttribution?.photoUri,
          rating,
          text,
          relativeTime: rev?.relativePublishTimeDescription ?? "recently",
          publishTime: rev?.publishTime,
          sentiment: sentimentFor(rating),
        });
      }
    }
    return { reviews: out.slice(0, 4) };
  } catch (e) {
    return { reviews: [], error: e instanceof Error ? e.message : "unknown" };
  }
}

export const getGoogleCommunityFeedback = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const status: ServiceStatus = { ok: true, attempted: 0, succeeded: 0, failed: 0, errors: [] };
  const reviews: GoogleCommunityReview[] = [];
  const tasks = POINTS.map(async (p) => {
    status.attempted++;
    const res = await fetchWardReviews(p);
    if (res.error) {
      status.failed++;
      status.errors.push(`${p.sector}: ${res.error}`);
    } else {
      status.succeeded++;
      reviews.push(...res.reviews);
    }
  });
  await Promise.all(tasks);
  status.ok = status.failed === 0;
  return {
    reviews,
    fetchedAt: new Date().toISOString(),
    source: "Google Maps Platform · Places API (New) reviews",
    status,
  } as GoogleCommunityFeedbackResult;
});
