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


/**
 * Talk about doses, ways of taking something or what "works" invites an answer
 * that reads as advice on using. A human decides on those, always.
 */
const SUBSTANCE_USE_PATTERNS = [
  /\b\d+\s?(mg|g|gram\w*|kam\w*)\b/i,
  /dawk\w*/i,
  /ile\s+(trzeba\s+)?(wzi(ąć|ac)|bra(ć|c)|sypa(ć|c)|wciąg\w*)/i,
  /kresk\w*/i,
  /wci(ą|a)g\w*/i,
  /pusty\s+(żołądek|zoladek)/i,
  /(łączy|laczy)(ć|c)\s+z\b/i,
  /miksow\w*/i,
  /nic\s+nie\s+daje/i,
  /nie\s+dzia(ł|l)a\s+na\s+mnie/i,
  /co\s+(najlepiej\s+)?dzia(ł|l)a/i,
  /(bad\s?trip|odlot|zejści|zejsci)\w*/i
];

export function mentionsSubstanceUse(text: string): boolean {
  return SUBSTANCE_USE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Why this message may not be answered automatically, if it may not. */
export function needsHumanApproval(text: string): string | undefined {
  if (isProvocative(text)) return "Zaczepka — odpowiedź wymaga zatwierdzenia.";
  if (mentionsSubstanceUse(text)) return "Komentarz dotyczy brania substancji — wymaga zatwierdzenia.";
  return undefined;
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
