// Server-side Gemini 1.5 call. Keeps GEMINI_API_KEY off the browser.
// Auth is OPTIONAL: signed-in callers get a higher token budget; anonymous
// callers (public /assistant route) fall back to a safe default config.
import { createServerFn } from "@tanstack/react-start";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AskInput = { prompt: string; context?: string };

const MAX_PROMPT_CHARS = 2000;
const MAX_CONTEXT_CHARS = 4000;

export const askGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown): AskInput => {
    if (!data || typeof data !== "object") throw new Error("Invalid input");
    const d = data as Record<string, unknown>;
    if (typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("Prompt is required");
    const prompt = d.prompt.trim();
    if (prompt.length > MAX_PROMPT_CHARS) {
      throw new Error(`Prompt exceeds maximum length of ${MAX_PROMPT_CHARS} characters`);
    }
    const rawCtx = typeof d.context === "string" ? d.context.trim() : "";
    const context = rawCtx.length > MAX_CONTEXT_CHARS ? rawCtx.slice(0, MAX_CONTEXT_CHARS) : rawCtx;
    return { prompt, context: context || undefined };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured on the server.");

    const isAuthed = context?.isAuthenticated ?? false;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        // Anonymous callers get a slightly more conservative default.
        temperature: isAuthed ? 0.4 : 0.3,
        maxOutputTokens: isAuthed ? 1024 : 512,
      },
    });

    const system = `You are CivicPulse, a municipal-ops AI grounded in real-time Google Maps Platform telemetry.
You will be given LIVE WARD METRICS containing per-ward Air Quality (AQI + dominant pollutant), Pollen (UPI 0–5 + pollen type), Weather (temperature + feels-like + condition), plus Google TrafficLayer congestion status. When live metrics are provided you MUST quote the actual figures (AQI values, dominant pollutants, pollen UPI, temperatures, weather conditions, traffic intensity) rather than inventing numbers.

Reply with STRICT JSON of shape:
{
 "headline": string (1 sentence, decisive, cites at least one live metric when metrics are provided),
 "confidence": integer 60-99,
 "bullets": [{"h": string (2-4 words), "t": string (1 sentence, cites the live metric it depends on)}] (3 items),
 "actions": [string] (3 short imperative recommendations tied to the live metrics)
}
No prose outside JSON. Ground answers in urban health, transit, environment, safety, utilities.`;

    const parts: Array<{ text: string }> = [{ text: system }];
    if (data.context) {
      parts.push({ text: `LIVE WARD METRICS:\n${data.context}` });
    }
    parts.push({ text: `Operator question: ${data.prompt}` });

    const result = await model.generateContent(parts);

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
