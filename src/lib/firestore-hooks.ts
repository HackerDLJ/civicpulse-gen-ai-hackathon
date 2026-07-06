// Live Firestore subscriptions for CivicPulse.
// Both hooks return `{ data, loading, error }`. `data` is null while loading and
// [] when the collection is empty — the UI distinguishes those states.
//
// Every document is normalized to the STRICT production schema so downstream
// charts, tables, and mutations never have to defend against missing fields:
//   alerts   → { title, detail, severity, sector, ts, ageMin, status, category }
//   feedback → { source, text, sentiment, category, ward, action, handled }
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { Alert, Feedback } from "@/lib/pulse-data";
import { updateAlertStatusFn, toggleFeedbackHandledFn } from "@/lib/firestore-mutations.functions";

type State<T> = { data: T[] | null; loading: boolean; error: string | null };

const ALERT_SEVERITIES: Alert["severity"][] = ["critical", "high", "medium", "low"];
const ALERT_STATUSES: Alert["status"][] = ["open", "resolved", "automated"];
const ALERT_CATEGORIES: Alert["category"][] = ["health", "environment", "traffic", "safety", "utility"];
const FEEDBACK_SOURCES: Feedback["source"][] = ["Twitter/X", "Forum", "Hotline", "SMS", "Reddit"];
const FEEDBACK_SENTIMENTS: Feedback["sentiment"][] = ["Positive", "Negative", "Neutral"];

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;
}
const s = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const n = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const b = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);

function normalizeAlert(id: string, d: DocumentData): Alert {
  return {
    id,
    title: s(d.title, "Untitled alert"),
    detail: s(d.detail),
    severity: pickEnum(d.severity, ALERT_SEVERITIES, "medium"),
    sector: s(d.sector, "—"),
    ts: s(d.ts, ""),
    ageMin: n(d.ageMin, 0),
    status: pickEnum(d.status, ALERT_STATUSES, "open"),
    category: pickEnum(d.category, ALERT_CATEGORIES, "utility"),
  };
}

function normalizeFeedback(id: string, d: DocumentData): Feedback {
  return {
    id,
    source: pickEnum(d.source, FEEDBACK_SOURCES, "Forum"),
    text: s(d.text),
    sentiment: pickEnum(d.sentiment, FEEDBACK_SENTIMENTS, "Neutral"),
    category: s(d.category, "General"),
    ward: s(d.ward, "—"),
    action: s(d.action, ""),
    handled: b(d.handled, false),
  };
}

function useCollection<T>(
  path: string,
  normalize: (id: string, d: DocumentData) => T,
  orderField?: string,
): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    try {
      const ref = collection(db, path);
      const q = orderField ? query(ref, orderBy(orderField, "desc")) : ref;
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (cancelled) return;
          const rows = snap.docs.map((doc) => normalize(doc.id, doc.data()));
          setState({ data: rows, loading: false, error: null });
        },
        (err) => {
          if (cancelled) return;
          setState({ data: null, loading: false, error: err.message });
        },
      );
      return () => {
        cancelled = true;
        unsub();
      };
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Firestore unavailable",
      });
      return () => {
        cancelled = true;
      };
    }
  }, [path, orderField, normalize]);

  return state;
}

export function useFirestoreAlerts() {
  return useCollection<Alert>("alerts", normalizeAlert, "ageMin");
}

export function useFirestoreFeedback() {
  return useCollection<Feedback>("feedback", normalizeFeedback);
}

// Mutations — routed through auth-gated server functions so anonymous users
// cannot modify live operational data. See src/lib/firestore-mutations.functions.ts.
export async function updateAlertStatus(id: string, status: Alert["status"]) {
  await updateAlertStatusFn({ data: { id, status } });
}

export async function toggleFeedbackHandled(id: string, handled: boolean) {
  await toggleFeedbackHandledFn({ data: { id, handled } });
}
