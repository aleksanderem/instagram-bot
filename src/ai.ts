import { existsSync, readFileSync } from "node:fs";
import { config } from "./config.js";
import { getEffectiveSettings, listPairs } from "./db.js";
import { fallbackDraft, holdReason, isProvocative, parseRiskAssessment, requiresHuman, validateDraft } from "./policy.js";
import { findSimilarPairs } from "./similar.js";
import type { Channel, ConversationPair, Draft, RiskAssessment } from "./types.js";

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


const PROVOCATION_RULE = `
Ta wiadomość jest zaczepką lub chamskim komentarzem wobec autorki marki.
Nie potwierdzaj i nie zaprzeczaj sugestii w niej zawartej — przestaw ramę rozmowy.
Nie tłumacz się, nie usprawiedliwiaj, nie moralizuj, nie dziękuj za komentarz.
Przy taniej zaczepce odpowiedz JEDNYM krótkim zdaniem, najwyżej kilka słów:
sucha riposta albo kontrpytanie w rodzaju "i co w związku z tym?".
Dopiero przy zarzucie merytorycznym odpowiedz dłużej i rzeczowo, faktami.
Jeśli znasz imię rozmówcy, możesz zwrócić się po imieniu.
Dozwolone emoji i znaki: 🍀 ❤️ 😉 😘 🤣 oraz :) i ;) — najwyżej jeden na odpowiedź.
Nie używaj wielokropka. Nie używaj słowa "zdrowienie" ani innych słów z języka pisanego.
`;

const SAFETY_RULE = `
Nigdy nie sugeruj sięgnięcia po substancję, spróbowania jej, zmiany dawki ani sposobu brania.
Nie pytaj "próbowałaś?", "brałeś?" ani podobnie tam, gdzie mowa o substancjach — takie pytanie czyta się jak zachęta.
Nie oceniaj, czy coś "działa" czy "nie działa". Przy pytaniach o branie kieruj do kontaktu z zespołem.
`;

const postContextSection = (post: string) =>
  post
    ? `Komentarz jest pod postem marki o treści:\n${post.slice(0, 2_000)}\n\nCzytaj komentarz w kontekście tego posta — te same słowa pod innym postem znaczą co innego.`
    : "";

const MAX_SIMILAR_PAIRS = 5;

const pastAnswersSection = (pairs: ConversationPair[]) =>
  pairs.length
    ? `Tak odpowiadaliśmy wcześniej na podobne wiadomości. Trzymaj się tego sposobu:\n${pairs
        .map((pair, index) => `${index + 1}. Pytanie: ${pair.question}\n   Nasza odpowiedź: ${pair.answer}`)
        .join("\n")}`
    : "";

/** The full prompt sent to the model, kept separate so it can be inspected in tests. */
export function buildDraftMessages(
  text: string,
  channel: Channel,
  pairs: ConversationPair[],
  brand: string,
  postContext = "",
  flags: { taunt?: boolean } = {}
): Array<{ role: string; content: string }> {
  const similar = findSimilarPairs(pairs, text, MAX_SIMILAR_PAIRS);
  const system = [
    knowledgeBase,
    SAFETY_RULE,
    `Księga marki:\n${brand}`,
    postContextSection(postContext),
    pastAnswersSection(similar),
    isProvocative(text) || flags.taunt ? PROVOCATION_RULE : ""
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Kanał: ${channel}. Wiadomość użytkownika: ${text}` }
  ];
}

const RISK_CRITERIA = `
Oceniasz wiadomość z Instagrama skierowaną do profilu o uzależnieniach, zanim ktokolwiek na nią odpowie.
Czytaj ją razem z postem, pod którym się pojawiła — te same słowa pod różnymi postami znaczą co innego.

"taunt": true, jeśli to zaczepka, drwina, obraza lub sugestia na temat życia seksualnego albo brania substancji przez autorkę profilu.

"substanceUse": true, jeśli wiadomość w jakikolwiek sposób dotyczy substancji — narkotyków, leków (także na receptę, np. sildenafil, leki nasenne, stymulanty), alkoholu —
w kontekście ich brania, działania lub braku działania, dawek, sposobu przyjmowania, łączenia, jakości, ceny, zdobywania albo seksu pod ich wpływem,
także żartem lub mimochodem. Również wtedy, gdy każda odpowiedź mogłaby zostać odczytana jako ocena, rada lub zachęta dotycząca brania.

W razie wątpliwości ustaw true. Odpowiadasz WYŁĄCZNIE obiektem JSON:
{"taunt": boolean, "substanceUse": boolean, "reason": string | null}
"reason" to jedno krótkie zdanie po polsku, dlaczego.
`;

/** The prompt asking the model to judge a message before a reply is drafted. */
export function buildRiskMessages(text: string, channel: Channel, postContext = ""): Array<{ role: string; content: string }> {
  const post = postContext ? `Post, pod którym jest wiadomość:\n${postContext.slice(0, 2_000)}\n\n` : "";
  return [
    { role: "system", content: RISK_CRITERIA },
    { role: "user", content: `${post}Kanał: ${channel}. Wiadomość: ${text}` }
  ];
}

async function assessRisk(text: string, channel: Channel, postContext: string): Promise<RiskAssessment> {
  try {
    const output = await chatCompletion(buildRiskMessages(text, channel, postContext), getEffectiveSettings().aiModel);
    return parseRiskAssessment(output);
  } catch {
    return { taunt: false, substanceUse: false, reason: null, failed: true };
  }
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

export async function createDraft(text: string, channel: Channel, postContext = ""): Promise<Draft> {
  const escalationReason = requiresHuman(text);
  if (escalationReason) return fallbackDraft(channel, escalationReason);
  if (!config.MINIMAX_API_KEY) return fallbackDraft(channel);

  const assessment = await assessRisk(text, channel, postContext);
  try {
    const output = await chatCompletion(
      buildDraftMessages(text, channel, listPairs(), brandContext(), postContext, { taunt: assessment.taunt }),
      getEffectiveSettings().aiModel
    );
    const draft = parseDraftJson(output);
    const issue = validateDraft(draft.text, channel);
    if (issue) return fallbackDraft(channel, issue);
    // Taunts and anything touching substances wait for a person, however confident the drafting model is.
    const hold = holdReason(text, assessment);
    return hold ? { ...draft, shouldEscalate: true, reason: hold } : draft;
  } catch {
    return fallbackDraft(channel, "Nie udało się bezpiecznie wygenerować odpowiedzi.");
  }
}
