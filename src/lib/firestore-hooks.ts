// Live Firestore subscriptions for CivicPulse.
// Both hooks return `{ data, loading, error }`. `data` is null while loading and
// [] when the collection is empty — the UI distinguishes those states.
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { Alert, Feedback } from "@/lib/pulse-data";

type State<T> = { data: T[] | null; loading: boolean; error: string | null };

function useCollection<T>(path: string, orderField?: string): State<T> {
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
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
          setState({ data: rows, loading: false, error: null });
        },
        (err) => {
          if (cancelled) return;
          setState({ data: null, loading: false, error: err.message });
        }
      );
      return () => {
        cancelled = true;
        unsub();
      };
    } catch (err) {
      setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Firestore unavailable" });
      return () => { cancelled = true; };
    }
  }, [path, orderField]);

  return state;
}

export function useFirestoreAlerts() {
  return useCollection<Alert>("alerts", "ageMin");
}

export function useFirestoreFeedback() {
  return useCollection<Feedback>("feedback");
}

// Mutations — write straight to Firestore so the snapshot listener picks up the change.
export async function updateAlertStatus(id: string, status: Alert["status"]) {
  await updateDoc(doc(db, "alerts", id), { status });
}

export async function toggleFeedbackHandled(id: string, handled: boolean) {
  await updateDoc(doc(db, "feedback", id), { handled });
}
