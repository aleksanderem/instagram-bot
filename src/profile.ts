import { existsSync, readFileSync } from "node:fs";
import { chatCompletion } from "./ai.js";
import { config } from "./config.js";
import { getEffectiveSettings, listPairs, listSamples } from "./db.js";
import type { ConversationPair } from "./types.js";

export type ProfileInput = {
  /** What the brand writes when answering people — the voice to copy. */
  replies: string[];
  /** Real exchanges, so the voice can be read together with what provoked it. */
  exchanges: ConversationPair[];
  /** Post captions — subject matter only; the written voice differs from the spoken one. */
  posts: string[];
  toneNotes: string;
  currentProfile: string;
};

const MAX_EXCHANGES = 40;
const MAX_REPLIES = 120;
const MAX_POSTS = 30;

const numbered = (texts: string[]) => texts.map((text, index) => `${index + 1}. ${text}`).join("\n");

const exchangesSection = (exchanges: ConversationPair[]) =>
  exchanges
    .slice(0, MAX_EXCHANGES)
    .map((pair, index) => `${index + 1}. Ktoś napisał: ${pair.question}\n   Marka odpowiedziała: ${pair.answer}`)
    .join("\n");

export function buildProfilePrompt(input: ProfileInput): string {
  if (!input.replies.length && !input.exchanges.length) {
    throw new Error("Brak odpowiedzi marki, z których można odczytać sposób rozmawiania.");
  }

  const sections = [
    "Na podstawie poniższych materiałów przygotuj księgę marki (profil komunikacji) w formacie Markdown.",
    "Struktura: ## Ton i styl, ## Zwroty i słownictwo, ## Emoji i interpunkcja, ## Jak odpowiadamy na zaczepki, ## FAQ (pytanie + zatwierdzona odpowiedź), ## Czego nie obiecujemy, ## Sprawy zawsze dla człowieka.",
    [
      "Ton i styl wyznaczaj wyłącznie na podstawie ODPOWIEDZI marki, nie na podstawie postów.",
      "Posty to język pisany — służą wyłącznie jako wiedza o tematach, nigdy jako wzór sposobu mówienia.",
      "Słowa, które pojawiają się tylko w postach, a nie w odpowiedziach, są zakazane w odpowiedziach — wypisz je w sekcji Zwroty i słownictwo jako zakazane.",
      "W sekcji Zwroty i słownictwo podaj dosłowne zwroty, których marka faktycznie używa, oraz typową długość odpowiedzi.",
      "W sekcji Emoji i interpunkcja wypisz konkretne emoji i znaki z podanych odpowiedzi, z częstością.",
      "W sekcji Jak odpowiadamy na zaczepki opisz wzorzec na podstawie podanych wymian i zacytuj dwa przykłady."
    ].join("\n"),
    "Nie wymyślaj cen, terminów ani faktów, których nie ma w materiałach. Pisz po polsku.",
    input.toneNotes ? `Dodatkowe wytyczne dotyczące tonu od właściciela marki:\n${input.toneNotes}` : "",
    input.currentProfile ? `Obecny profil (zaktualizuj go, nie zaczynaj od zera):\n${input.currentProfile}` : "",
    input.replies.length ? `ODPOWIEDZI MARKI — tak marka rozmawia, to jest wzór tonu:\n${numbered(input.replies.slice(0, MAX_REPLIES))}` : "",
    input.exchanges.length ? `PRAWDZIWE WYMIANY — na co marka odpowiadała i jak:\n${exchangesSection(input.exchanges)}` : "",
    input.posts.length ? `POSTY — wyłącznie tematy i wiedza, NIE wzór tonu:\n${numbered(input.posts.slice(0, MAX_POSTS))}` : ""
  ];

  return sections.filter(Boolean).join("\n\n");
}

export async function generateBrandProfile(): Promise<string> {
  const settings = getEffectiveSettings();
  const samples = listSamples();
  const pairs = listPairs();
  const currentProfile = existsSync(config.BRAND_CONTEXT_PATH)
    ? readFileSync(config.BRAND_CONTEXT_PATH, "utf8").slice(0, 20_000)
    : "";

  const prompt = buildProfilePrompt({
    replies: samples.filter((sample) => sample.source !== "instagram-post").map((sample) => sample.text),
    exchanges: pairs,
    posts: samples.filter((sample) => sample.source === "instagram-post").map((sample) => sample.text),
    toneNotes: settings.toneNotes,
    currentProfile
  });
  return chatCompletion([{ role: "user", content: prompt }], settings.aiModel);
}
