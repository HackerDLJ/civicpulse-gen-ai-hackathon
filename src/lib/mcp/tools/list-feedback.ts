import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const sources = ["Twitter/X", "Forum", "Hotline", "SMS", "Reddit"] as const;
const sentiments = ["Positive", "Negative", "Neutral"] as const;

const feedbackSchema = z.object({
  id: z.string(),
  source: z.enum(sources),
  text: z.string(),
  sentiment: z.enum(sentiments),
  category: z.string(),
  ward: z.string(),
  action: z.string(),
  handled: z.boolean(),
});

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export default defineTool({
  name: "list_feedback",
  title: "List citizen feedback",
  description:
    "List citizen feedback signals from the live Firestore `feedback` collection, with optional sentiment and ward filters. Returns items conforming to the strict production feedback schema.",
  inputSchema: {
    sentiment: z.enum(sentiments).optional(),
    ward: z.string().optional().describe("Case-insensitive substring match on ward, e.g. 'Ward 3'."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  outputSchema: {
    feedback: z.array(feedbackSchema),
    count: z.number().int(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ sentiment, ward, limit }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    const projectId = "civicpulse-gen-ai-hackathon";
    if (!apiKey) {
      return { content: [{ type: "text", text: "GOOGLE_API_KEY is not configured on the server." }], isError: true };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/feedback?pageSize=${limit}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { content: [{ type: "text", text: `Firestore error ${res.status}: ${await res.text()}` }], isError: true };
    }
    const body = (await res.json()) as {
      documents?: Array<{ name: string; fields?: Record<string, { stringValue?: string; booleanValue?: boolean }> }>;
    };
    const rows = (body.documents ?? []).map((d) => {
      const f = d.fields ?? {};
      return {
        id: d.name.split("/").pop() ?? "",
        source: pickEnum(f.source?.stringValue, sources, "Forum"),
        text: f.text?.stringValue ?? "",
        sentiment: pickEnum(f.sentiment?.stringValue, sentiments, "Neutral"),
        category: f.category?.stringValue ?? "General",
        ward: f.ward?.stringValue ?? "—",
        action: f.action?.stringValue ?? "",
        handled: f.handled?.booleanValue ?? false,
      };
    });
    const filtered = rows.filter((r) =>
      (!sentiment || r.sentiment === sentiment) &&
      (!ward || r.ward.toLowerCase().includes(ward.toLowerCase()))
    );
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { feedback: filtered, count: filtered.length },
    };
  },
});
