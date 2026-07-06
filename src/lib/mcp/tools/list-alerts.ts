import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const severities = ["critical", "high", "medium", "low"] as const;

export default defineTool({
  name: "list_alerts",
  title: "List live civic alerts",
  description:
    "List active CivicPulse alerts from the live Firestore `alerts` collection. Supports filtering by severity, sector, and status so agents can triage the city in real time.",
  inputSchema: {
    severity: z.enum(severities).optional().describe("Only return alerts of this severity."),
    sector: z.string().optional().describe("Case-insensitive sector name substring, e.g. 'Ward 3'."),
    status: z.enum(["open", "automated", "resolved"]).optional().describe("Only return alerts in this status."),
    limit: z.number().int().min(1).max(100).default(25).describe("Max alerts to return."),
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
    const body = (await res.json()) as { documents?: Array<{ name: string; fields?: Record<string, { stringValue?: string; integerValue?: string }> }> };
    const rows = (body.documents ?? []).map((d) => {
      const f = d.fields ?? {};
      const val = (k: string) => f[k]?.stringValue ?? f[k]?.integerValue ?? "";
      return {
        id: d.name.split("/").pop() ?? "",
        title: String(val("title")),
        detail: String(val("detail")),
        severity: String(val("severity")),
        sector: String(val("sector")),
        status: String(val("status")),
        category: String(val("category")),
        ts: String(val("ts")),
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
