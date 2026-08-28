// Wysyła podpisany webhook z testową wiadomością DM do lokalnego serwera.
// Użycie: node scripts/simulate-dm.mjs [port] — wymaga META_APP_SECRET w .env
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
);

const port = process.argv[2] ?? "3010";
const secret = env.META_APP_SECRET;
if (!secret) throw new Error("META_APP_SECRET missing in .env");

const messages = [
  { mid: `demo-${Date.now()}-1`, text: "Dzień dobry! Czy macie wolne terminy w najbliższą sobotę?" },
  { mid: `demo-${Date.now()}-2`, text: "Ile kosztuje pierwsza konsultacja i jak mogę się umówić?" }
];

for (const message of messages) {
  const payload = JSON.stringify({
    entry: [
      {
        id: "17841400000000000",
        messaging: [{ sender: { id: "555000111" }, message: { mid: message.mid, text: message.text } }]
      }
    ]
  });
  const signature = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const response = await fetch(`http://localhost:${port}/webhooks/instagram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
    body: payload
  });
  console.log(message.mid, response.status);
}
