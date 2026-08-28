// Nagrywa screencasty panelu do App Review Meta.
// Użycie: ADMIN_KEY=... BASE_URL=http://localhost:3010 node scripts/record-screencasts.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3010";
const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) throw new Error("Set ADMIN_KEY env var.");

const OUT_DIR = new URL("../screencasts/", import.meta.url).pathname;
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

async function scene(name, run) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } }
  });
  const page = await context.newPage();
  try {
    await login(page);
    await run(page);
    await page.waitForTimeout(1500);
  } finally {
    const video = page.video();
    await context.close();
    const path = await video.path();
    const { renameSync } = await import("node:fs");
    renameSync(path, `${OUT_DIR}${name}.webm`);
    console.log("scene done:", name);
  }
}

async function login(page) {
  await page.goto(`${BASE_URL}/panel/`);
  await page.waitForTimeout(1200);
  await page.fill("#admin-key", ADMIN_KEY);
  await page.waitForTimeout(600);
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Skrzynka", { timeout: 10_000 });
  await page.waitForTimeout(1200);
}

async function openTab(page, label) {
  await page.click(`[role=tab]:has-text("${label}")`);
  await page.waitForTimeout(1500);
}

// Scena 1: logowanie + przegląd zakładek (instagram_business_basic)
await scene("01-login-i-przeglad", async (page) => {
  await openTab(page, "Ustawienia");
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1200);
  await openTab(page, "Konto Instagram");
  await openTab(page, "Profil komunikacji");
  await openTab(page, "Skrzynka");
});

// Scena 2: ustawienia — kanały odpowiedzi i ton (konfiguracja bota)
await scene("02-ustawienia", async (page) => {
  await openTab(page, "Ustawienia");
  await page.click("#respond-comments");
  await page.waitForTimeout(900);
  await page.click("#respond-comments");
  await page.waitForTimeout(600);
  await page.fill("#tone-notes", "Ciepło i konkretnie, bez wykrzykników. Zwracamy się na Ty. Zawsze proponujemy następny krok.");
  await page.waitForTimeout(800);
  await page.click("button:has-text('Zapisz ustawienia')");
  await page.waitForSelector("text=Ustawienia zapisane", { timeout: 10_000 });
});

// Scena 3: profil komunikacji — próbki + generowanie przez AI
await scene("03-profil-komunikacji", async (page) => {
  await openTab(page, "Profil komunikacji");
  await page.fill(
    "#pasted",
    "Klient: Czy macie wolne terminy w sobotę?\nMy: Tak — najbliższy wolny termin to sobota 12:00. Napisz, a zarezerwujemy.\n\nKlient: Ile trwa pierwsza wizyta?\nMy: Pierwsza wizyta to około 45 minut, w tym rozmowa o Twoich potrzebach."
  );
  await page.waitForTimeout(800);
  await page.click("button:has-text('Dodaj do bazy')");
  await page.waitForSelector("text=Dodano", { timeout: 10_000 });
  await page.waitForTimeout(1000);
  await page.click("button:has-text('Zbuduj profil z wiadomości')");
  await page.waitForSelector("text=Profil wygenerowany", { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.click("button:has-text('Zapisz profil')");
  await page.waitForSelector("text=Profil komunikacji zapisany", { timeout: 10_000 });
});

// Scena 4: skrzynka — wiadomość z IG, szkic AI, edycja i moderacja (manage_messages)
await scene("04-skrzynka-moderacja", async (page) => {
  await openTab(page, "Skrzynka");
  await page.waitForSelector("text=wiadomość", { timeout: 10_000 });
  const textarea = page.locator("textarea").first();
  await textarea.click();
  await page.waitForTimeout(800);
  await textarea.fill("Dziękujemy za wiadomość! Najbliższy wolny termin w sobotę to 12:00 — napisz, a zarezerwujemy go dla Ciebie.");
  await page.waitForTimeout(1500);
  const rejectButtons = page.locator("button:has-text('Odrzuć')");
  await rejectButtons.last().click();
  await page.waitForSelector("text=Propozycja odrzucona", { timeout: 10_000 });
});

await browser.close();
console.log("Wszystkie sceny nagrane do", OUT_DIR);
