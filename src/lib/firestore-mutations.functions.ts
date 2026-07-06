// Auth-gated server-side Firestore mutations for CivicPulse.
//
// Alert status changes and feedback handling used to be written directly to
// Firestore from the browser with no authentication. Those writes are now
// funneled through these server functions, which require a valid Supabase
// session (`requireSupabaseAuth`) before performing the update against the
// Firestore REST API. Anonymous visitors can no longer mutate operational
// state even if the Firestore Security Rules ever loosen.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIREBASE_PROJECT_ID = "civicpulse-gen-ai-hackathon";
const FIREBASE_API_KEY_FALLBACK = "AIzaSyBsOWU_kjz_IwWNseCtaSVJTvuwCRphtz0";

const ALERT_STATUSES = ["open", "resolved", "automated"] as const;
type AlertStatus = (typeof ALERT_STATUSES)[number];

function firestoreApiKey(): string {
  return process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || FIREBASE_API_KEY_FALLBACK;
}

async function patchDocument(
  collection: string,
  id: string,
  fields: Record<string, { stringValue: string } | { booleanValue: boolean }>,
  updateMaskPaths: string[],
): Promise<void> {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`,
  );
  for (const path of updateMaskPaths) url.searchParams.append("updateMask.fieldPaths", path);
  url.searchParams.set("key", firestoreApiKey());

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore update failed [${res.status}]: ${body}`);
  }
}

function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 1500 && !/[\/]/.test(id);
}

export const updateAlertStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { id: string; status: AlertStatus } => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid input");
    const d = raw as Record<string, unknown>;
    if (!isValidDocId(d.id)) throw new Error("Invalid alert id");
    if (typeof d.status !== "string" || !(ALERT_STATUSES as readonly string[]).includes(d.status)) {
      throw new Error("Invalid alert status");
    }
    return { id: d.id, status: d.status as AlertStatus };
  })
  .handler(async ({ data }) => {
    await patchDocument("alerts", data.id, { status: { stringValue: data.status } }, ["status"]);
    return { ok: true };
  });

export const toggleFeedbackHandledFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): { id: string; handled: boolean } => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid input");
    const d = raw as Record<string, unknown>;
    if (!isValidDocId(d.id)) throw new Error("Invalid feedback id");
    if (typeof d.handled !== "boolean") throw new Error("Invalid handled value");
    return { id: d.id, handled: d.handled };
  })
  .handler(async ({ data }) => {
    await patchDocument("feedback", data.id, { handled: { booleanValue: data.handled } }, ["handled"]);
    return { ok: true };
  });
