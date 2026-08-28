import { existsSync, readFileSync } from "node:fs";
import { chatCompletion } from "./ai.js";
import { config } from "./config.js";
import { getEffectiveSettings, listSamples } from "./db.js";

export function buildProfilePrompt(samples: string[], toneNotes: string, currentProfile: string): string {
  if (!samples.length) throw new Error("Add at least one sample message before generating a profile.");
  const numbered = samples.map((text, index) => `${index + 1}. ${text}`).join("\n");
  const sections = [
    "Na podstawie poniższych przykładowych treści marki przygotuj księgę marki (profil komunikacji) w formacie Markdown.",
    "Struktura: ## Ton i styl, ## FAQ (pytanie + zatwierdzona odpowiedź), ## Czego nie obiecujemy, ## Sprawy zawsze dla człowieka.",
    "Nie wymyślaj cen, terminów ani faktów, których nie ma w przykładach. Pisz po polsku.",
    toneNotes ? `Dodatkowe wytyczne dotyczące tonu od właściciela marki:\n${toneNotes}` : "",
    currentProfile ? `Obecny profil (zaktualizuj go, nie zaczynaj od zera):\n${currentProfile}` : "",
    `Przykładowe treści (wiadomości klientów, odpowiedzi marki, posty i komentarze profilu):\n${numbered}`
  ];
  return sections.filter(Boolean).join("\n\n");
}

export async function generateBrandProfile(): Promise<string> {
  const settings = getEffectiveSettings();
  const samples = listSamples().map((sample) => sample.text);
  const currentProfile = existsSync(config.BRAND_CONTEXT_PATH)
    ? readFileSync(config.BRAND_CONTEXT_PATH, "utf8").slice(0, 20_000)
    : "";
  const prompt = buildProfilePrompt(samples, settings.toneNotes, currentProfile);
  return chatCompletion([{ role: "user", content: prompt }], settings.aiModel);
}
