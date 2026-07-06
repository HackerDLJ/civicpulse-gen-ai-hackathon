// Server-side Gemini 1.5 call. Keeps GEMINI_API_KEY off the browser.
import { createServerFn } from "@tanstack/react-start";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AskInput = { prompt: string };

export const askGemini = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): AskInput => {
    if (!data || typeof data !== "object") throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("Prompt is required");
    return { prompt: d.prompt.trim() };
  })
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured on the server.");

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    });

    const system = `You are CivicPulse, a municipal-ops AI. Reply with STRICT JSON of shape:
{
 "headline": string (1 sentence, decisive),
 "confidence": integer 60-99,
 "bullets": [{"h": string (2-4 words), "t": string (1 sentence)}] (3 items),
 "actions": [string] (3 short imperative recommendations)
}
No prose outside JSON. Ground answers in urban health, transit, environment, safety, utilities.`;

    const result = await model.generateContent([
      { text: system },
      { text: `Operator question: ${data.prompt}` },
    ]);

    const text = result.response.text();
    try {
      const parsed = JSON.parse(text);
      return {
        headline: String(parsed.headline ?? "Gemini returned no headline."),
        confidence: Math.max(50, Math.min(99, Number(parsed.confidence) || 85)),
        bullets: Array.isArray(parsed.bullets)
          ? parsed.bullets.slice(0, 4).map((b: { h?: unknown; t?: unknown }) => ({
              h: String(b.h ?? ""),
              t: String(b.t ?? ""),
            }))
          : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4).map((a: unknown) => String(a)) : [],
      };
    } catch {
      // Fallback: wrap raw text as a single-bullet answer.
      return {
        headline: text.split("\n")[0].slice(0, 160) || "Gemini response received.",
        confidence: 80,
        bullets: [{ h: "Model output", t: text.slice(0, 400) }],
        actions: [],
      };
    }
  });
