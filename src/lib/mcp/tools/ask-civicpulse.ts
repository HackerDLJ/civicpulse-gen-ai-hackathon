import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ask_civicpulse",
  title: "Ask the CivicPulse decision assistant",
  description:
    "Send a natural-language operations question about the city (health, transit, environment, safety, utilities). Returns a structured JSON answer with a headline, confidence, three bullets, and recommended actions — powered by Gemini 1.5 Pro.",
  inputSchema: {
    prompt: z.string().min(4).max(2000).describe("The operator's question, e.g. 'Where should we deploy mobile clinics tonight?'"),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ prompt }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { content: [{ type: "text", text: "GEMINI_API_KEY is not configured on the server." }], isError: true };
    }
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest",
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    });
    const system = `You are CivicPulse, a municipal-ops AI. Reply with STRICT JSON:
{"headline": string, "confidence": integer 60-99, "bullets":[{"h":string,"t":string}] (3),"actions":[string] (3)}
No prose outside JSON.`;
    const result = await model.generateContent([{ text: system }, { text: `Operator question: ${prompt}` }]);
    const text = result.response.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { headline: text.slice(0, 200), confidence: 75, bullets: [], actions: [] }; }
    return {
      content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
      structuredContent: { answer: parsed },
    };
  },
});
