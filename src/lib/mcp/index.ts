import { defineMcp } from "@lovable.dev/mcp-js";
import listAlerts from "./tools/list-alerts";
import listFeedback from "./tools/list-feedback";
import askCivicpulse from "./tools/ask-civicpulse";

export default defineMcp({
  name: "civicpulse-mcp",
  title: "CivicPulse MCP",
  version: "0.1.0",
  instructions:
    "CivicPulse exposes live smart-city operations data and a Gemini-backed decision assistant. Use `list_alerts` and `list_feedback` to read the live Firestore collections, and `ask_civicpulse` for grounded municipal reasoning (returns a headline, bullets, and recommended actions).",
  tools: [listAlerts, listFeedback, askCivicpulse],
});
