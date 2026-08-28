import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
import { effectiveSettings, type EffectiveSettings, type StoredSettings } from "./settings.js";
import type { Channel, ReviewStatus } from "./types.js";

type Account = { instagram_id: string; username: string | null; encrypted_access_token: string; created_at: string; updated_at: string };
type Inbound = { external_id: string; account_id: string; channel: Channel; sender_id: string; text: string; reply_to_id: string | null; received_at: string };
type Review = { id: number; external_id: string; draft_text: string; status: ReviewStatus; reason: string | null; created_at: string; updated_at: string };
type Sample = { id: number; text: string; source: string; added_at: string };
type Store = {
  accounts: Record<string, Account>;
  inbound: Record<string, Inbound>;
  reviews: Review[];
  nextReviewId: number;
  settings: StoredSettings;
  samples: Sample[];
  nextSampleId: number;
};

const databasePath = config.DATABASE_PATH;
mkdirSync(dirname(databasePath), { recursive: true });

const emptyStore = (): Store => ({ accounts: {}, inbound: {}, reviews: [], nextReviewId: 1, settings: {}, samples: [], nextSampleId: 1 });

function load(): Store {
  if (!existsSync(databasePath)) return emptyStore();
  // Older data files may predate settings/samples — fill in the new fields.
  return { ...emptyStore(), ...(JSON.parse(readFileSync(databasePath, "utf8")) as Partial<Store>) };
}

let store = load();
function save() {
  const tempPath = `${databasePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
  renameSync(tempPath, databasePath);
}

export function upsertAccount(instagramId: string, username: string | undefined, encryptedAccessToken: string) {
  const now = new Date().toISOString();
  const previous = store.accounts[instagramId];
  store.accounts[instagramId] = {
    instagram_id: instagramId,
    username: username ?? null,
    encrypted_access_token: encryptedAccessToken,
    created_at: previous?.created_at ?? now,
    updated_at: now
  };
  save();
}

export function getAccount(instagramId: string) {
  return store.accounts[instagramId];
}

export function insertInbound(event: { externalId: string; accountId: string; channel: Channel; senderId: string; text: string; replyToId?: string }) {
  if (store.inbound[event.externalId]) return false;
  store.inbound[event.externalId] = {
    external_id: event.externalId,
    account_id: event.accountId,
    channel: event.channel,
    sender_id: event.senderId,
    text: event.text,
    reply_to_id: event.replyToId ?? null,
    received_at: new Date().toISOString()
  };
  save();
  return true;
}

export function createReview(externalId: string, draftText: string, status: ReviewStatus, reason?: string) {
  if (store.reviews.some((review) => review.external_id === externalId)) return;
  const now = new Date().toISOString();
  store.reviews.push({ id: store.nextReviewId++, external_id: externalId, draft_text: draftText, status, reason: reason ?? null, created_at: now, updated_at: now });
  save();
}

export function listReviews() {
  return store.reviews
    .map((review) => ({ ...review, ...store.inbound[review.external_id], inbound_text: store.inbound[review.external_id]?.text }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100);
}

export function getReview(id: number) {
  const review = store.reviews.find((candidate) => candidate.id === id);
  const inbound = review ? store.inbound[review.external_id] : undefined;
  return review && inbound ? { ...review, ...inbound } : undefined;
}

export function getStoredSettings(): StoredSettings {
  return store.settings;
}

export function getEffectiveSettings(): EffectiveSettings {
  return effectiveSettings(
    {
      autoSendConfidentDrafts: config.autoSendConfidentDrafts,
      aiModel: config.MINIMAX_MODEL,
      allowedInstagramAccountIds: config.allowedInstagramAccountIds
    },
    store.settings
  );
}

export function saveSettingsPatch(patch: StoredSettings) {
  store.settings = { ...store.settings, ...patch };
  save();
  return getEffectiveSettings();
}

export function listSamples() {
  return store.samples;
}

export function addSamples(texts: string[], source = "manual") {
  const now = new Date().toISOString();
  const existing = new Set(store.samples.map((sample) => sample.text));
  let added = 0;
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed || existing.has(trimmed)) continue;
    existing.add(trimmed);
    store.samples.push({ id: store.nextSampleId++, text: trimmed, source, added_at: now });
    added++;
  }
  if (added) save();
  return { samples: store.samples, added };
}

export function listAccounts() {
  return Object.values(store.accounts).map(({ instagram_id, username, created_at, updated_at }) => ({
    instagram_id,
    username,
    created_at,
    updated_at
  }));
}

export function deleteSample(id: number) {
  const before = store.samples.length;
  store.samples = store.samples.filter((sample) => sample.id !== id);
  if (store.samples.length !== before) save();
  return store.samples.length !== before;
}

export function updateReview(id: number, status: ReviewStatus, draftText?: string) {
  const review = store.reviews.find((candidate) => candidate.id === id);
  if (!review) return;
  review.status = status;
  if (draftText !== undefined) review.draft_text = draftText;
  review.updated_at = new Date().toISOString();
  save();
}
