import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const answerSchema = z.object({
  headline: z.string(),
  confidence: z.number().int(),
  bullets: z.array(z.object({ h: z.string(), t: z.string() })),
  actions: z.array(z.string()),
});

export default defineTool({
  name: "ask_civicpulse",
  title: "Ask the CivicPulse decision assistant",
  description:
    "Send a natural-language operations question about the city (health, transit, environment, safety, utilities). Returns a structured JSON answer with a headline, confidence, three bullets, and recommended actions — powered by Gemini 1.5 Pro.",
  inputSchema: {
    prompt: z.string().min(4).max(2000).describe("The operator's question, e.g. 'Where should we deploy mobile clinics tonight?'"),
  },
  outputSchema: { answer: answerSchema },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ prompt }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { content: [{ type: "text", text: "GEMINI_API_KEY is not configured on the server." }], isError: true };
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    });
    const system = `You are CivicPulse, a municipal-ops AI. Reply with STRICT JSON:
{"headline": string, "confidence": integer 60-99, "bullets":[{"h":string,"t":string}] (3),"actions":[string] (3)}
No prose outside JSON.`;
    const result = await model.generateContent([{ text: system }, { text: `Operator question: ${prompt}` }]);
    const text = result.response.text();
    let raw: Record<string, unknown>;
    try { raw = JSON.parse(text) as Record<string, unknown>; } catch {
      raw = { headline: text.slice(0, 200), confidence: 75, bullets: [], actions: [] };
    }
    const answer = {
      headline: String(raw.headline ?? "Gemini returned no headline."),
      confidence: Math.max(60, Math.min(99, Number(raw.confidence) || 85)),
      bullets: Array.isArray(raw.bullets)
        ? raw.bullets.slice(0, 3).map((b) => ({ h: String((b as { h?: unknown }).h ?? ""), t: String((b as { t?: unknown }).t ?? "") }))
        : [],
      actions: Array.isArray(raw.actions) ? raw.actions.slice(0, 3).map((a) => String(a)) : [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
      structuredContent: { answer },
    };
  },
});
