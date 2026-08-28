import { existsSync, readFileSync } from "node:fs";
import { config } from "./config.js";
import { getEffectiveSettings } from "./db.js";
import { fallbackDraft, requiresHuman, validateDraft } from "./policy.js";
import type { Channel, Draft } from "./types.js";

const knowledgeBase = `
Jesteś asystentem marki na Instagramie. Odpowiadasz po polsku, rzeczowo, uprzejmie i krótko.
Nie wymyślaj cen, dostępności, regulaminów, terminów ani informacji o zamówieniach.
Nie składaj gwarancji ani obietnic absolutnych. Nie prosisz o dane wrażliwe w komentarzu.
Jeżeli brakuje faktów lub sprawa jest wrażliwa, ustaw shouldEscalate=true.
Ton: ciepły, konkretny, naturalny. Maksimum dwa zdania; dla komentarza maksymalnie jedno zdanie.
Odpowiadasz WYŁĄCZNIE poprawnym obiektem JSON o polach:
{"text": string, "shouldEscalate": boolean, "reason": string | null, "confidence": "high" | "medium" | "low"}
Bez żadnego tekstu przed ani po obiekcie JSON.
`;

function brandContext() {
  if (!existsSync(config.BRAND_CONTEXT_PATH)) return "Brak dodatkowej księgi marki. Nie zgaduj faktów o firmie.";
  return readFileSync(config.BRAND_CONTEXT_PATH, "utf8").slice(0, 20_000);
}

type ChatCompletionsPayload = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

// MiniMax (OpenAI-compatible) returns the answer in choices[0].message.content;
// reasoning models may prepend a <think>…</think> block that must be dropped.
export function extractChatText(payload: ChatCompletionsPayload): string {
  const content = payload.choices?.[0]?.message?.content ?? "";
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// Models sometimes wrap JSON in markdown fences or add stray prose around it.
export function parseDraftJson(text: string): Draft {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in AI response.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Draft;
}

export async function chatCompletion(messages: Array<{ role: string; content: string }>, model: string): Promise<string> {
  if (!config.MINIMAX_API_KEY) throw new Error("MINIMAX_API_KEY must be configured.");
  const response = await fetch(`${config.MINIMAX_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.MINIMAX_API_KEY}` },
    body: JSON.stringify({ model, messages })
  });
  if (!response.ok) throw new Error(`MiniMax request failed: ${await response.text()}`);
  const text = extractChatText((await response.json()) as ChatCompletionsPayload);
  if (!text) throw new Error("AI response contained no text output.");
  return text;
}

export async function createDraft(text: string, channel: Channel): Promise<Draft> {
  const escalationReason = requiresHuman(text);
  if (escalationReason) return fallbackDraft(channel, escalationReason);
  if (!config.MINIMAX_API_KEY) return fallbackDraft(channel);

  try {
    const output = await chatCompletion(
      [
        { role: "system", content: `${knowledgeBase}\n\nKsięga marki:\n${brandContext()}` },
        { role: "user", content: `Kanał: ${channel}. Wiadomość użytkownika: ${text}` }
      ],
      getEffectiveSettings().aiModel
    );
    const draft = parseDraftJson(output);
    const issue = validateDraft(draft.text, channel);
    if (issue) return fallbackDraft(channel, issue);
    return draft;
  } catch {
    return fallbackDraft(channel, "Nie udało się bezpiecznie wygenerować odpowiedzi.");
  }
}
