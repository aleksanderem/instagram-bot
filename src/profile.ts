import { existsSync, readFileSync } from "node:fs";
import { extractOutputText } from "./ai.js";
import { config } from "./config.js";
import { getEffectiveSettings, listSamples } from "./db.js";

export function buildProfilePrompt(samples: string[], toneNotes: string, currentProfile: string): string {
  if (!samples.length) throw new Error("Add at least one sample message before generating a profile.");
  const numbered = samples.map((text, index) => `${index + 1}. ${text}`).join("\n");
  const sections = [
    "Na podstawie poniższych przykładowych wiadomości przygotuj księgę marki (profil komunikacji) w formacie Markdown.",
    "Struktura: ## Ton i styl, ## FAQ (pytanie + zatwierdzona odpowiedź), ## Czego nie obiecujemy, ## Sprawy zawsze dla człowieka.",
    "Nie wymyślaj cen, terminów ani faktów, których nie ma w przykładach. Pisz po polsku.",
    toneNotes ? `Dodatkowe wytyczne dotyczące tonu od właściciela marki:\n${toneNotes}` : "",
    currentProfile ? `Obecny profil (zaktualizuj go, nie zaczynaj od zera):\n${currentProfile}` : "",
    `Przykładowe wiadomości od klientów i odpowiedzi marki:\n${numbered}`
  ];
  return sections.filter(Boolean).join("\n\n");
}

export async function generateBrandProfile(): Promise<string> {
  if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY must be configured to generate a profile.");
  const settings = getEffectiveSettings();
  const samples = listSamples().map((sample) => sample.text);
  const currentProfile = existsSync(config.BRAND_CONTEXT_PATH)
    ? readFileSync(config.BRAND_CONTEXT_PATH, "utf8").slice(0, 20_000)
    : "";
  const prompt = buildProfilePrompt(samples, settings.toneNotes, currentProfile);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: settings.openaiModel, input: prompt })
  });
  if (!response.ok) throw new Error(`Profile generation failed: ${await response.text()}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error("AI response contained no text output.");
  return outputText;
}
