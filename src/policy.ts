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


/**
 * Baiting comments that hint at the author's own drug use or sex life. They get a
 * professional non-answer, never a denial or a confirmation, and never auto-send.
 */
const PROVOCATION_PATTERNS = [
  /lubi(ł|l)a(ś|s)?\s+si(ę|e)\s+grza/i,
  /grza(ć|c)\s+si(ę|e)/i,
  /chemsex/i,
  /seks\w*\s+(po|na|z)\s+\w*(dragach|narkotyk|mefedron|kokain|amfet)/i,
  /(po|na)\s+(dragach|prochach)/i,
  /ile\s+(chłopa|chlopa|facet|panów|panow)/i,
  /(ćpa|cpa)(ła|la)(ś|s)/i,
  /brała(ś|s)\s+i\s+/i
];

/** True when the message is a taunt about sex or drug use rather than a real question. */
export function isProvocative(text: string): boolean {
  return PROVOCATION_PATTERNS.some((pattern) => pattern.test(text));
}

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
