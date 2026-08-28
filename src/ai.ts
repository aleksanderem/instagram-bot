import { existsSync, readFileSync } from "node:fs";
import { config } from "./config.js";
import { fallbackDraft, requiresHuman, validateDraft } from "./policy.js";
import type { Channel, Draft } from "./types.js";

const knowledgeBase = `
Jesteś asystentem marki na Instagramie. Odpowiadasz po polsku, rzeczowo, uprzejmie i krótko.
Nie wymyślaj cen, dostępności, regulaminów, terminów ani informacji o zamówieniach.
Nie składaj gwarancji ani obietnic absolutnych. Nie prosisz o dane wrażliwe w komentarzu.
Jeżeli brakuje faktów lub sprawa jest wrażliwa, ustaw shouldEscalate=true.
Ton: ciepły, konkretny, naturalny. Maksimum dwa zdania; dla komentarza maksymalnie jedno zdanie.
`;

type ResponsesApiPayload = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

// The raw /v1/responses API returns text inside output[].content[]; the
// top-level output_text convenience field exists only in official SDKs.
export function extractOutputText(payload: ResponsesApiPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  return (payload.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

function brandContext() {
  if (!existsSync(config.BRAND_CONTEXT_PATH)) return "Brak dodatkowej księgi marki. Nie zgaduj faktów o firmie.";
  return readFileSync(config.BRAND_CONTEXT_PATH, "utf8").slice(0, 20_000);
}

export async function createDraft(text: string, channel: Channel): Promise<Draft> {
  const escalationReason = requiresHuman(text);
  if (escalationReason) return fallbackDraft(channel, escalationReason);
  if (!config.OPENAI_API_KEY) return fallbackDraft(channel);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: config.OPENAI_MODEL,
        input: [
          { role: "system", content: `${knowledgeBase}\n\nKsięga marki:\n${brandContext()}` },
          { role: "user", content: `Kanał: ${channel}. Wiadomość użytkownika: ${text}` }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "instagram_reply",
            strict: true,
            schema: {
              type: "object",
              properties: {
                text: { type: "string" },
                shouldEscalate: { type: "boolean" },
                reason: { type: ["string", "null"] },
                confidence: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["text", "shouldEscalate", "reason", "confidence"],
              additionalProperties: false
            }
          }
        }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = (await response.json()) as ResponsesApiPayload;
    const outputText = extractOutputText(data);
    if (!outputText) throw new Error("AI response contained no text output.");
    const draft = JSON.parse(outputText) as Draft;
    const issue = validateDraft(draft.text, channel);
    if (issue) return fallbackDraft(channel, issue);
    return draft;
  } catch {
    return fallbackDraft(channel, "Nie udało się bezpiecznie wygenerować odpowiedzi.");
  }
}
