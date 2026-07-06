// Shared mock data + session state for Pulse platform.
import { useSyncExternalStore } from "react";

export type Alert = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low";
  sector: string;
  ts: string;
  ageMin: number;
  status: "open" | "resolved" | "automated";
  category: "health" | "environment" | "traffic" | "safety" | "utility";
};

export type Feedback = {
  id: string;
  source: "Twitter/X" | "Forum" | "Hotline" | "SMS" | "Reddit";
  text: string;
  sentiment: "Positive" | "Negative" | "Neutral";
  category: string;
  ward: string;
  action: string;
  handled: boolean;
};

export type StreamEvent = {
  id: string;
  ts: string;
  channel: string;
  message: string;
  tone: "indigo" | "teal" | "emerald" | "amber" | "rose";
};

type Store = {
  alerts: Alert[];
  feedback: Feedback[];
  stream: StreamEvent[];
};

const initialAlerts: Alert[] = [
  { id: "a1", title: "Unseasonal 22% spike in respiratory complaints", detail: "Sector B — correlation with PM2.5 rise near industrial belt.", severity: "critical", sector: "Sector B", ts: "2m ago", ageMin: 2, status: "open", category: "health" },
  { id: "a2", title: "Traffic cascade risk on Ring Road E-14", detail: "Predicted congestion +38% in the next 40 minutes.", severity: "high", sector: "Ring Rd E-14", ts: "6m ago", ageMin: 6, status: "open", category: "traffic" },
  { id: "a3", title: "Water pressure anomaly detected", detail: "Ward 7 substation reporting 0.7 bar deviation over baseline.", severity: "medium", sector: "Ward 7", ts: "14m ago", ageMin: 14, status: "open", category: "utility" },
  { id: "a4", title: "Heat island intensification", detail: "Downtown grid trending +2.4°C above forecast.", severity: "high", sector: "Downtown", ts: "22m ago", ageMin: 22, status: "open", category: "environment" },
  { id: "a5", title: "Crowd density > 8k in Central Plaza", detail: "Model suggests safety threshold breach in 25 min.", severity: "medium", sector: "Central Plaza", ts: "31m ago", ageMin: 31, status: "open", category: "safety" },
  { id: "a6", title: "Clinic capacity 92% in Ward 3", detail: "Overflow triggers within 90 min at current arrival rate.", severity: "high", sector: "Ward 3", ts: "44m ago", ageMin: 44, status: "open", category: "health" },
  { id: "a7", title: "PM2.5 exceedance · Riverside industrial", detail: "5-node rolling avg breached 65 µg/m³ threshold.", severity: "medium", sector: "Riverside", ts: "1h 12m ago", ageMin: 72, status: "open", category: "environment" },
  { id: "a8", title: "NR-9 junction spillback recurring", detail: "Fourth cascade in the last 3h at 4th Ave junction.", severity: "low", sector: "NR-9 / 4th Ave", ts: "2h 30m ago", ageMin: 150, status: "open", category: "traffic" },
  { id: "a9", title: "Streetlight cluster outage", detail: "12 lights offline · Ward 5 · Maple corridor.", severity: "medium", sector: "Ward 5", ts: "4h 05m ago", ageMin: 245, status: "open", category: "safety" },
  { id: "a10", title: "EMR anomaly · Ward 2 pediatric fever cluster", detail: "Bayesian model detected 3.1σ deviation over baseline.", severity: "high", sector: "Ward 2", ts: "8h 20m ago", ageMin: 500, status: "open", category: "health" },
  { id: "a11", title: "Overnight sanitation route missed", detail: "Downtown loop truck offline — dispatched replacement.", severity: "low", sector: "Downtown", ts: "14h ago", ageMin: 840, status: "automated", category: "utility" },
  { id: "a12", title: "Grid load balancing initiated", detail: "Auto-shifted 4.2 MW from substation W7 to W8.", severity: "low", sector: "Ward 8", ts: "22h ago", ageMin: 1320, status: "resolved", category: "utility" },
];

const initialFeedback: Feedback[] = [
  { id: "f1", source: "Twitter/X", text: "Air feels heavy near the east bypass again, kids coughing all night 😷", sentiment: "Negative", category: "Air Quality", ward: "Sector B", action: "Route to Env. Health Task Force", handled: false },
  { id: "f2", source: "Forum", text: "New bike lanes on 4th Ave are honestly a game changer, commute cut in half.", sentiment: "Positive", category: "Transit", ward: "Ward 2", action: "Log as success signal", handled: false },
  { id: "f3", source: "Hotline", text: "Streetlight out for 3 days at Maple & 7th, unsafe walking home.", sentiment: "Negative", category: "Public Safety", ward: "Ward 5", action: "Dispatch maintenance crew #4", handled: false },
  { id: "f4", source: "Reddit", text: "Wait times at the ward 3 clinic are wild rn, 3+ hours.", sentiment: "Negative", category: "Healthcare", ward: "Ward 3", action: "Reassign 2 mobile units", handled: false },
  { id: "f5", source: "SMS", text: "Trash pickup skipped our block again. Bins overflowing.", sentiment: "Negative", category: "Sanitation", ward: "Ward 6", action: "Notify sanitation ops", handled: false },
  { id: "f6", source: "Twitter/X", text: "Loving the new pop-up market at Riverside, so vibrant!", sentiment: "Positive", category: "Community", ward: "Riverside", action: "Amplify in weekly digest", handled: false },
  { id: "f7", source: "Forum", text: "Not sure what's going on with the new parking rules, confusing signage.", sentiment: "Neutral", category: "Transit", ward: "Downtown", action: "Queue signage clarity review", handled: false },
];

const initialStream: StreamEvent[] = [
  { id: "s1", ts: "now", channel: "Ingestion", message: "MOCK API Ingestion: 54 unstructured citizen reports processed via Gemini LLM", tone: "indigo" },
  { id: "s2", ts: "3s", channel: "Sensor Grid", message: "AQI telemetry synced across 214 nodes — 3 outliers flagged", tone: "teal" },
  { id: "s3", ts: "8s", channel: "Transit", message: "GTFS-RT normalized: 1,842 vehicle pings deduplicated", tone: "emerald" },
  { id: "s4", ts: "14s", channel: "Health", message: "EMR anomaly classifier: respiratory cluster confidence 0.94", tone: "amber" },
  { id: "s5", ts: "21s", channel: "Safety", message: "CCTV crowd density estimator processed 12 feeds", tone: "indigo" },
];

let state: Store = {
  alerts: initialAlerts,
  feedback: initialFeedback,
  stream: initialStream,
};
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

export const store = {
  get: () => state,
  resolveAlert(id: string) {
    state = { ...state, alerts: state.alerts.map((a) => a.id === id ? { ...a, status: "resolved" } : a) };
    emit();
  },
  automateAlert(id: string) {
    state = { ...state, alerts: state.alerts.map((a) => a.id === id ? { ...a, status: "automated" } : a) };
    emit();
  },
  handleFeedback(id: string) {
    state = { ...state, feedback: state.feedback.map((f) => f.id === id ? { ...f, handled: !f.handled } : f) };
    emit();
  },
  pushStream(ev: Omit<StreamEvent, "id" | "ts">) {
    const id = "s" + Math.random().toString(36).slice(2, 8);
    state = { ...state, stream: [{ ...ev, id, ts: "now" }, ...state.stream].slice(0, 40) };
    emit();
  },
};

export function useStore<T>(selector: (s: Store) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// Chart data
export const aqiTrend = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  aqi: Math.round(60 + 25 * Math.sin(i / 3) + Math.random() * 15),
  pm25: Math.round(30 + 12 * Math.sin(i / 4 + 1) + Math.random() * 8),
}));

export const trafficLoad = Array.from({ length: 12 }, (_, i) => ({
  window: `${i * 2}h`,
  congestion: Math.round(40 + 30 * Math.sin(i / 2) + Math.random() * 10),
  incidents: Math.round(4 + Math.random() * 6),
}));

export const wardSatisfaction = [
  { ward: "W1", score: 78 },
  { ward: "W2", score: 85 },
  { ward: "W3", score: 62 },
  { ward: "W4", score: 74 },
  { ward: "W5", score: 68 },
  { ward: "W6", score: 71 },
  { ward: "W7", score: 82 },
  { ward: "W8", score: 88 },
];

export const resourceMix = [
  { name: "Health", value: 34 },
  { name: "Transit", value: 26 },
  { name: "Safety", value: 18 },
  { name: "Environment", value: 14 },
  { name: "Utilities", value: 8 },
];

export const forecastSeries = Array.from({ length: 14 }, (_, i) => ({
  t: `T+${i * 4}h`,
  demand: Math.round(50 + 20 * Math.sin(i / 2) + i * 1.4),
  capacity: 80,
  forecast: Math.round(55 + 22 * Math.sin(i / 2 + 0.4) + i * 1.6),
}));
