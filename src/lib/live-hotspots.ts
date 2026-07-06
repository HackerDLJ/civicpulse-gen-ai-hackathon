// Shared client-side hook + derivations for the live Google Maps Platform
// data feed. Centralized here so Dashboard, Alerts, and Assistant all read
// from the SAME react-query cache entry and derived summaries stay consistent.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLiveHotspots, type LiveHotspot, type WardMetrics, type LiveHotspotsResult } from "@/lib/google-maps.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Alert, StreamEvent } from "@/lib/pulse-data";

export const LIVE_HOTSPOTS_KEY = ["live-hotspots"] as const;

export function useHasSession() {
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setHasSession(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return hasSession;
}

export function useLiveHotspots() {
  const fetchLive = useServerFn(getLiveHotspots);
  const enabled = useHasSession();
  return useQuery<LiveHotspotsResult>({
    queryKey: LIVE_HOTSPOTS_KEY,
    queryFn: () => fetchLive() as Promise<LiveHotspotsResult>,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    retry: 2,
    retryDelay: (n) => Math.min(30_000, 2 ** n * 1000),
    enabled,
  });
}

// ---------- Alert derivation ----------

/**
 * Derive live-alert rows from the current Google hotspot set. Critical, High,
 * and Medium severities are elevated into the Live Alerts feed so the anomaly
 * pipeline reacts to real AQI/pollen/heat/traffic readings even before
 * anything lands in Firestore.
 */
export function deriveGoogleAlerts(result: LiveHotspotsResult | undefined): Alert[] {
  if (!result) return [];
  const fetched = new Date(result.fetchedAt).getTime();
  const ageMin = Math.max(0, Math.round((Date.now() - fetched) / 60000));
  const ts = ageMin === 0 ? "just now" : ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;

  const sevMap = { Critical: "critical", High: "high", Medium: "medium", Low: "low" } as const;

  return result.hotspots
    .filter((h): h is LiveHotspot & { severity: keyof typeof sevMap } => h.severity in sevMap)
    .map<Alert>((h) => ({
      id: `google-${h.id}`,
      title: googleAlertTitle(h),
      detail: `Google Maps live signal · ${h.metric} = ${h.value}. ${h.detail}`,
      severity: sevMap[h.severity],
      sector: h.sector,
      ts,
      ageMin,
      status: "open",
      category: h.layer === "traffic" ? "traffic" : h.layer === "health" ? "health" : "environment",
    }));
}

function googleAlertTitle(h: LiveHotspot): string {
  if (h.id.startsWith("aq-")) return `AQI ${h.value} anomaly · ${h.sector}`;
  if (h.id.startsWith("pl-")) return `Pollen UPI ${h.value} spike · ${h.sector}`;
  if (h.id.startsWith("wx-")) return `Heat stress ${h.value} · ${h.sector}`;
  if (h.id.startsWith("tr-")) return `Traffic congestion · ${h.sector}`;
  return `${h.title} · ${h.sector}`;
}

// ---------- Stream event derivation ----------

/**
 * Build a batch of Ingested Data Streams entries from a single refresh cycle
 * of the Google Maps feed. Each returned entry has a channel, transformation
 * summary, and enough ward context to be useful in the operator feed.
 */
export function buildGoogleStreamEvents(result: LiveHotspotsResult): Array<Omit<StreamEvent, "id" | "ts">> {
  const events: Array<Omit<StreamEvent, "id" | "ts">> = [];
  const { services, metrics, hotspots } = result;

  // Per-service ingestion summaries (transformation notes)
  if (services.airQuality.attempted > 0) {
    events.push({
      channel: "Google · Air Quality",
      tone: services.airQuality.ok ? "teal" : "rose",
      message: services.airQuality.ok
        ? `Ingested AQI + dominant pollutant across ${services.airQuality.succeeded}/${services.airQuality.attempted} wards → normalized to CivicPulse env layer`
        : `AQI ingest degraded (${services.airQuality.failed} failed) — cached last-known reading`,
    });
  }
  if (services.pollen.attempted > 0) {
    events.push({
      channel: "Google · Pollen",
      tone: services.pollen.ok ? "indigo" : "rose",
      message: services.pollen.ok
        ? `Pollen UPI forecast (${services.pollen.succeeded}/${services.pollen.attempted}) mapped to health-layer hotspots`
        : `Pollen ingest degraded (${services.pollen.failed} failed) — retry scheduled`,
    });
  }
  if (services.weather.attempted > 0) {
    events.push({
      channel: "Google · Weather",
      tone: services.weather.ok ? "emerald" : "rose",
      message: services.weather.ok
        ? `Current conditions (${services.weather.succeeded}/${services.weather.attempted}) fused into heat-risk score`
        : `Weather ingest degraded (${services.weather.failed} failed) — heat-risk score partial`,
    });
  }
  events.push({
    channel: "Google · Traffic Layer",
    tone: "amber",
    message: `Google TrafficLayer tiles refreshed · ${metrics.length} ward cells rebound`,
  });

  // Highlight the two most severe live hotspots this cycle so operators see
  // the concrete ward + value that landed in the feed.
  const rankSev = { Critical: 4, High: 3, Medium: 2, Low: 1, Nominal: 0 } as const;
  const highlights = [...hotspots].sort((a, b) => rankSev[b.severity] - rankSev[a.severity]).slice(0, 2);
  for (const h of highlights) {
    if (h.severity === "Nominal" || h.severity === "Low") continue;
    events.push({
      channel: h.layer === "health" ? "Google · Pollen" : h.layer === "environment" ? "Google · Air/Weather" : "Google · Traffic",
      tone: h.severity === "Critical" ? "rose" : "amber",
      message: `${h.sector} · ${h.title} → ${h.metric} ${h.value} (severity ${h.severity})`,
    });
  }

  return events;
}

// ---------- Assistant grounding context ----------

/**
 * Turn the live ward metrics into a compact grounding string the Gemini
 * assistant can quote when answering operator questions. Kept small so it
 * fits inside the prompt-length cap.
 */
export function buildAssistantContext(result: LiveHotspotsResult | undefined): string {
  if (!result) return "";
  const time = new Date(result.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const lines: string[] = [];
  lines.push(`Live ward metrics (Google Maps Platform, fetched ${time}):`);
  for (const m of result.metrics) {
    const parts: string[] = [];
    if (typeof m.aqi === "number") parts.push(`AQI ${m.aqi}${m.dominantPollutant ? ` (${m.dominantPollutant})` : ""}${m.aqiCategory ? ` — ${m.aqiCategory}` : ""}`);
    if (typeof m.pollenUpi === "number") parts.push(`Pollen UPI ${m.pollenUpi}${m.pollenType ? ` (${m.pollenType})` : ""}`);
    if (typeof m.tempC === "number") parts.push(`Temp ${m.tempC.toFixed(1)}°C${typeof m.feelsLikeC === "number" ? ` (feels ${m.feelsLikeC.toFixed(1)}°C)` : ""}${m.weatherCondition ? ` · ${m.weatherCondition}` : ""}`);
    lines.push(`- ${m.sector}: ${parts.join(" · ") || "no reading"}`);
  }
  const svc = result.services;
  lines.push(`Traffic intensity: Google TrafficLayer overlay live (real-time congestion tiles across ${result.metrics.length} focal wards).`);
  lines.push(`Service health: Air Quality ${svc.airQuality.succeeded}/${svc.airQuality.attempted} · Pollen ${svc.pollen.succeeded}/${svc.pollen.attempted} · Weather ${svc.weather.succeeded}/${svc.weather.attempted}.`);
  return lines.join("\n").slice(0, 3500);
}

export type { LiveHotspot, WardMetrics, LiveHotspotsResult };
