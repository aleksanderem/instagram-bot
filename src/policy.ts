import type { Channel, Draft } from "./types.js";

const ESCALATION_PATTERNS = [
  /reklamacj/i,
  /zwrot/i,
  /płatno|platno|faktur/i,
  /prawnik|sąd|sad|pozew/i,
  /rodo|dane osobowe/i,
  /oszust|kradzież|kradziez/i,
  /piln|natychmiast/i
];

const UNSAFE_PROMISES = [
  /gwarantujemy/i,
  /na pewno/i,
  /zawsze/i,
  /100%/i];

export function requiresHuman(text: string): string | undefined {
  const matching = ESCALATION_PATTERNS.find((pattern) => pattern.test(text));
  return matching ? "Wiadomość dotyczy sprawy wymagającej obsługi przez człowieka." : undefined;
}

export function validateDraft(text: string, channel: Channel): string | undefined {
  if (!text.trim()) return "Odpowiedź jest pusta.";
  if (text.length > (channel === "comment" ? 500 : 1000)) return "Odpowiedź jest zbyt długa.";
  if (UNSAFE_PROMISES.some((pattern) => pattern.test(text))) {
    return "Odpowiedź zawiera zbyt kategoryczną obietnicę.";
  }
  return undefined;
}

export function fallbackDraft(channel: Channel, escalationReason?: string): Draft {
  if (escalationReason) {
    return {
      text: "Dziękujemy za wiadomość. Przekazujemy sprawę do zespołu, który wróci do Ciebie możliwie szybko.",
      shouldEscalate: true,
      reason: escalationReason,
      confidence: "high"
    };
  }
  return {
    text:
      channel === "comment"
        ? "Dziękujemy za komentarz! Sprawdzimy to i wrócimy z odpowiedzią wkrótce."
        : "Dziękujemy za wiadomość! Przekazujemy ją do zespołu i wrócimy z odpowiedzią możliwie szybko.",
    shouldEscalate: true,
    reason: "Brak skonfigurowanego modelu AI lub pewnej odpowiedzi.",
    confidence: "low"
  };
}
