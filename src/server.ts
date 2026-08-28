import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createDraft } from "./ai.js";
import { config, hasEncryptionKey, hasMetaOAuthConfig } from "./config.js";
import { decrypt, encrypt } from "./crypto.js";
import {
  addSamples,
  createReview,
  deleteSample,
  getAccount,
  getEffectiveSettings,
  getReview,
  getStoredSettings,
  insertInbound,
  listReviews,
  listSamples,
  saveSettingsPatch,
  updateReview,
  upsertAccount
} from "./db.js";
import { buildAuthorizationUrl, exchangeCode, getInstagramAccount, parseWebhook, replyToComment, sendMessage } from "./meta.js";
import { validateDraft } from "./policy.js";
import { generateBrandProfile } from "./profile.js";
import type { EffectiveSettings } from "./settings.js";
import { sanitizeSettingsPatch } from "./settings.js";

const app = express();
type RequestWithRawBody = express.Request & { rawBody?: Buffer };
app.use(express.json({ limit: "1mb", verify: (req, _res, body) => { (req as RequestWithRawBody).rawBody = body; } }));
const oauthStates = new Set<string>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, metaOAuthConfigured: hasMetaOAuthConfig(), aiConfigured: Boolean(config.OPENAI_API_KEY) });
});

app.get("/auth/instagram/start", (_req, res) => {
  if (!hasMetaOAuthConfig() || !hasEncryptionKey()) return res.status(503).json({ error: "Configure Meta OAuth and TOKEN_ENCRYPTION_KEY first." });
  const state = randomUUID();
  oauthStates.add(state);
  res.redirect(buildAuthorizationUrl(state));
});

app.get("/auth/instagram/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).type("text/plain").send(`Meta authorization was declined: ${String(error)}`);
  if (typeof code !== "string" || typeof state !== "string" || !oauthStates.delete(state)) return res.status(400).send("Invalid or expired OAuth state.");
  try {
    const token = await exchangeCode(code);
    const account = await getInstagramAccount(token.access_token);
    const allowed = getEffectiveSettings().allowedInstagramAccountIds;
    if (allowed.size && !allowed.has(account.id)) return res.status(403).send("This Instagram account is not allowed.");
    upsertAccount(account.id, account.username, encrypt(token.access_token));
    res.type("html").send("<h1>Instagram connected</h1><p>You can close this window and configure webhooks in Meta.</p>");
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Instagram authorization failed" });
  }
});

app.get("/webhooks/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string" || !config.META_VERIFY_TOKEN) return res.sendStatus(403);
  const expected = Buffer.from(config.META_VERIFY_TOKEN);
  const received = Buffer.from(token);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return res.sendStatus(403);
  res.status(200).send(challenge);
});

app.post("/webhooks/instagram", async (req, res) => {
  if (!hasValidMetaSignature(req as RequestWithRawBody)) return res.sendStatus(403);
  res.sendStatus(200); // Meta requires a quick acknowledgement; process asynchronously.
  void processInboundWebhook(req.body).catch((error) => console.error("Webhook processing failed", error));
});

app.use("/api", requireAdmin);
app.get("/api/reviews", (_req, res) => res.json(listReviews()));

app.post("/api/reviews/:id/send", async (req, res) => {
  const review = getReview(Number(req.params.id));
  if (!review) return res.sendStatus(404);
  if (review.status === "sent") return res.status(409).json({ error: "This response was already sent." });
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : review.draft_text;
  const issue = validateDraft(text, review.channel);
  if (issue) return res.status(422).json({ error: issue });
  try {
    await sendReview(review.id, text);
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Meta send failed" });
  }
});

app.post("/api/reviews/:id/reject", (req, res) => {
  const review = getReview(Number(req.params.id));
  if (!review) return res.sendStatus(404);
  updateReview(review.id, "rejected");
  res.json({ ok: true });
});

function settingsResponse(effective: EffectiveSettings) {
  return { stored: getStoredSettings(), effective: { ...effective, allowedInstagramAccountIds: [...effective.allowedInstagramAccountIds] } };
}

app.get("/api/settings", (_req, res) => res.json(settingsResponse(getEffectiveSettings())));

app.put("/api/settings", (req, res) => {
  try {
    res.json(settingsResponse(saveSettingsPatch(sanitizeSettingsPatch(req.body))));
  } catch (error) {
    res.status(422).json({ error: error instanceof Error ? error.message : "Invalid settings." });
  }
});

app.get("/api/profile/samples", (_req, res) => res.json(listSamples()));

app.post("/api/profile/samples", (req, res) => {
  const texts = Array.isArray(req.body?.texts)
    ? req.body.texts
    : typeof req.body?.text === "string"
      ? [req.body.text]
      : undefined;
  if (!texts || texts.some((text: unknown) => typeof text !== "string")) {
    return res.status(422).json({ error: "Provide text or texts[] with sample messages." });
  }
  res.json(addSamples(texts as string[]));
});

app.delete("/api/profile/samples/:id", (req, res) => {
  if (!deleteSample(Number(req.params.id))) return res.sendStatus(404);
  res.json({ ok: true });
});

app.get("/api/brand", (_req, res) => {
  const content = existsSync(config.BRAND_CONTEXT_PATH) ? readFileSync(config.BRAND_CONTEXT_PATH, "utf8") : "";
  res.json({ content, path: config.BRAND_CONTEXT_PATH });
});

app.put("/api/brand", (req, res) => {
  const content = req.body?.content;
  if (typeof content !== "string" || content.length > 100_000) {
    return res.status(422).json({ error: "Provide content (string, max 100k characters)." });
  }
  writeFileSync(config.BRAND_CONTEXT_PATH, content, "utf8");
  res.json({ ok: true });
});

app.post("/api/profile/generate", async (_req, res) => {
  try {
    res.json({ content: await generateBrandProfile() });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Profile generation failed." });
  }
});

const panelDist = resolve(dirname(fileURLToPath(import.meta.url)), "../panel/dist");
app.use("/panel", express.static(panelDist));

function hasValidMetaSignature(req: RequestWithRawBody) {
  if (!config.META_APP_SECRET || !req.rawBody) return false;
  const signature = req.header("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", config.META_APP_SECRET).update(req.rawBody).digest("hex")}`;
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!config.ADMIN_API_KEY) return res.status(503).json({ error: "ADMIN_API_KEY must be configured before using the moderation API." });
  const provided = req.header("x-admin-api-key");
  if (!provided) return res.sendStatus(401);
  const expected = Buffer.from(config.ADMIN_API_KEY);
  const received = Buffer.from(provided);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return res.sendStatus(401);
  next();
}

async function processInboundWebhook(payload: unknown) {
  const settings = getEffectiveSettings();
  for (const event of parseWebhook(payload)) {
    if (settings.allowedInstagramAccountIds.size && !settings.allowedInstagramAccountIds.has(event.accountId)) continue;
    if (!insertInbound(event)) continue; // delivery retries must not create duplicate replies
    const draft = await createDraft(event.text, event.channel);
    const draftIssue = validateDraft(draft.text, event.channel);
    const status = draft.shouldEscalate || draftIssue || draft.confidence !== "high" ? "pending" : "approved";
    createReview(event.externalId, draft.text, status, draft.reason ?? draftIssue);
    if (status === "approved" && settings.autoSendConfidentDrafts) {
      const queued = listReviews().find((review) => review.external_id === event.externalId);
      if (queued) await sendReview(queued.id, draft.text);
    }
  }
}

async function sendReview(id: number, replacementText?: string) {
  const review = getReview(id);
  if (!review) throw new Error("Review not found.");
  if (review.status === "sent") throw new Error("This response was already sent.");
  const text = replacementText?.trim() || review.draft_text;
  const issue = validateDraft(text, review.channel);
  if (issue) throw new Error(issue);
  const account = getAccount(review.account_id);
  if (!account) throw new Error("Instagram account is not connected.");
  const token = decrypt(account.encrypted_access_token);
  if (review.channel === "dm") await sendMessage(review.account_id, review.sender_id, text, token);
  else if (review.reply_to_id) await replyToComment(review.reply_to_id, text, token);
  else throw new Error("Comment reply target is missing.");
  updateReview(review.id, "sent", text);
}

app.listen(config.PORT, () => console.log(`Instagram Copilot listening on port ${config.PORT}`));
