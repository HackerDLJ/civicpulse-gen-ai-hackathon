import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const severities = ["critical", "high", "medium", "low"] as const;
const statuses = ["open", "automated", "resolved"] as const;
const categories = ["health", "environment", "traffic", "safety", "utility"] as const;

const alertSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(severities),
  sector: z.string(),
  ts: z.string(),
  ageMin: z.number(),
  status: z.enum(statuses),
  category: z.enum(categories),
});

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export default defineTool({
  name: "list_alerts",
  title: "List live civic alerts",
  description:
    "List active CivicPulse alerts from the live Firestore `alerts` collection. Supports filtering by severity, sector, and status so agents can triage the city in real time. Returns items conforming to the strict production alert schema.",
  inputSchema: {
    severity: z.enum(severities).optional().describe("Only return alerts of this severity."),
    sector: z.string().optional().describe("Case-insensitive sector name substring, e.g. 'Ward 3'."),
    status: z.enum(statuses).optional().describe("Only return alerts in this status."),
    limit: z.number().int().min(1).max(100).default(25).describe("Max alerts to return."),
  },
  outputSchema: {
    alerts: z.array(alertSchema),
    count: z.number().int(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ severity, sector, status, limit }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const projectId = "civicpulse-gen-ai-hackathon";
    if (!apiKey) {
      return { content: [{ type: "text", text: "GOOGLE_API_KEY is not configured on the server." }], isError: true };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/alerts?pageSize=${limit}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text", text: `Firestore error ${res.status}: ${await res.text()}` }], isError: true };
    }
    const body = (await res.json()) as {
      documents?: Array<{
        name: string;
        fields?: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }>;
      }>;
    };
    const rows = (body.documents ?? []).map((d) => {
      const f = d.fields ?? {};
      const str = (k: string) => f[k]?.stringValue ?? "";
      const num = (k: string) => {
        const v = f[k];
        if (!v) return 0;
        if (typeof v.integerValue === "string") return Number(v.integerValue) || 0;
        if (typeof v.doubleValue === "number") return v.doubleValue;
        return 0;
      };
      return {
        id: d.name.split("/").pop() ?? "",
        title: str("title") || "Untitled alert",
        detail: str("detail"),
        severity: pickEnum(str("severity"), severities, "medium"),
        sector: str("sector") || "—",
        ts: str("ts"),
        ageMin: num("ageMin"),
        status: pickEnum(str("status"), statuses, "open"),
        category: pickEnum(str("category"), categories, "utility"),
      };
    });
    const filtered = rows.filter((r) =>
      (!severity || r.severity === severity) &&
      (!sector || r.sector.toLowerCase().includes(sector.toLowerCase())) &&
      (!status || r.status === status)
    );
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { alerts: filtered, count: filtered.length },
    };
  },
});
