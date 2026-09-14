import { decrypt } from "./crypto.js";
import { addPairs, addSamples, getAccount, getMediaCaption, rememberMedia, upsertAccount } from "./db.js";
import { fetchConversationMessages, fetchMediaCaption, fetchMediaComments, fetchOwnMedia, getInstagramAccount } from "./meta.js";
import type { ConversationPair } from "./types.js";

type CommentNode = { id?: unknown; parent_id?: unknown; text?: unknown; from?: { id?: unknown }; replies?: { data?: CommentNode[] } };
type MessageNode = { from?: { id?: unknown }; message?: unknown; created_time?: unknown };

// Comments and replies written by the profile itself (its own voice).
export function ownCommentTexts(comments: CommentNode[], accountId: string): string[] {
  const texts: string[] = [];
  for (const comment of comments) {
    if (String(comment.from?.id ?? "") === accountId && typeof comment.text === "string" && comment.text.trim()) {
      texts.push(comment.text.trim());
    }
    for (const reply of comment.replies?.data ?? []) {
      if (String(reply.from?.id ?? "") === accountId && typeof reply.text === "string" && reply.text.trim()) {
        texts.push(reply.text.trim());
      }
    }
  }
  return texts;
}

// DM messages sent by the profile (not by customers).
export function ownMessageTexts(messages: MessageNode[], accountId: string): string[] {
  return messages
    .filter((message) => String(message.from?.id ?? "") === accountId)
    .map((message) => (typeof message.message === "string" ? message.message.trim() : ""))
    .filter(Boolean);
}


const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Replies open with the handle of the person being answered, which says nothing about tone.
const stripLeadingMention = (text: string) => text.replace(/^(@[\w.]+\s+)+/, "").trim();

// Emoji-only reactions teach the model nothing about how to answer.
const carriesWords = (text: string) => /\p{L}{2,}/u.test(text);

const asAnswer = (text: unknown) => {
  const answer = stripLeadingMention(cleanText(text));
  return carriesWords(answer) ? answer : "";
};

/**
 * Comments from other people together with the reply the account wrote back.
 * Instagram returns the account's replies as ordinary comments pointing at their
 * parent, and occasionally nested under it, so both shapes are read.
 */
export function ownCommentPairs(comments: CommentNode[], accountId: string): ConversationPair[] {
  const byId = new Map(comments.filter((comment) => comment.id).map((comment) => [String(comment.id), comment]));
  const isOurs = (comment: CommentNode) => String(comment.from?.id ?? "") === accountId;
  const pairs: ConversationPair[] = [];

  for (const comment of comments) {
    if (isOurs(comment)) {
      const parent = comment.parent_id ? byId.get(String(comment.parent_id)) : undefined;
      const question = parent && !isOurs(parent) ? cleanText(parent.text) : "";
      const answer = asAnswer(comment.text);
      if (question && answer) pairs.push({ question, answer, source: "instagram-comment" });
      continue;
    }
    const question = cleanText(comment.text);
    if (!question) continue;
    for (const reply of comment.replies?.data ?? []) {
      const answer = asAnswer(reply.text);
      if (answer && isOurs(reply)) pairs.push({ question, answer, source: "instagram-comment" });
    }
  }
  return pairs;
}

/** Incoming messages together with the reply the account sent back, oldest first. */
export function ownMessagePairs(messages: MessageNode[], accountId: string): ConversationPair[] {
  const ordered = [...messages].sort((a, b) => String(a.created_time ?? "").localeCompare(String(b.created_time ?? "")));
  const pairs: ConversationPair[] = [];
  let question = "";
  let reply: string[] = [];

  const flush = () => {
    if (question && reply.length) pairs.push({ question, answer: reply.join("\n"), source: "instagram-dm" });
    reply = [];
  };

  for (const message of ordered) {
    const text = cleanText(message.message);
    if (!text) continue;
    if (String(message.from?.id ?? "") === accountId) {
      if (carriesWords(text)) reply.push(text);
      continue;
    }
    flush();
    question = text;
  }
  flush();
  return pairs;
}

export type ImportResult = {
  posts: number;
  comments: number;
  messages: number;
  /** Past conversations kept as question/answer pairs, used to answer in the same way. */
  pairs: number;
  errors: string[];
};

// High enough to cover a whole profile; a guard only against pathologically large accounts.
const MAX_MEDIA_FOR_COMMENTS = 200;

/**
 * Instagram signs the account's own posts, comments and DMs with its user id,
 * which is not the id the account is stored under. Compare against that one.
 */
export function ownContentId(account: { instagram_id: string; ig_user_id?: string | null }): string {
  return account.ig_user_id || account.instagram_id;
}

/** Accounts connected before the user id was stored need it filled in once. */
async function ensureOwnContentId(account: { instagram_id: string; ig_user_id?: string | null; username: string | null; encrypted_access_token: string }, token: string) {
  if (account.ig_user_id) return account.ig_user_id;
  const fresh = await getInstagramAccount(token);
  if (!fresh.user_id) return account.instagram_id;
  upsertAccount(account.instagram_id, account.username ?? undefined, account.encrypted_access_token, fresh.user_id);
  return fresh.user_id;
}


/**
 * The caption of the post a comment sits under. Comments usually arrive on posts
 * fresher than the last import, so an unknown post is fetched once and kept.
 */
export async function resolvePostContext(accountId: string, mediaId: string | null | undefined): Promise<string> {
  if (!mediaId) return "";
  const known = getMediaCaption(mediaId);
  if (known) return known;
  const account = getAccount(accountId);
  if (!account) return "";
  try {
    const caption = await fetchMediaCaption(mediaId, decrypt(account.encrypted_access_token));
    rememberMedia(mediaId, caption);
    return caption;
  } catch {
    return "";
  }
}

export async function importAccountContent(accountId: string): Promise<ImportResult> {
  const account = getAccount(accountId);
  if (!account) throw new Error("Instagram account is not connected.");
  const token = decrypt(account.encrypted_access_token);
  const ownId = await ensureOwnContentId(account, token);
  const result: ImportResult = { posts: 0, comments: 0, messages: 0, pairs: 0, errors: [] };

  let mediaIds: string[] = [];
  try {
    const media = await fetchOwnMedia(token);
    mediaIds = media.map((item) => item.id);
    for (const item of media) rememberMedia(item.id, String(item.caption ?? ""));
    const captions = media.map((item) => item.caption).filter(Boolean);
    result.posts = addSamples(captions, "instagram-post").added;
  } catch (error) {
    result.errors.push(`Posty: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const texts: string[] = [];
    const pairs: ConversationPair[] = [];
    for (const mediaId of mediaIds.slice(0, MAX_MEDIA_FOR_COMMENTS)) {
      const comments = await fetchMediaComments(mediaId, token);
      texts.push(...ownCommentTexts(comments, ownId));
      pairs.push(...ownCommentPairs(comments, ownId));
    }
    result.comments = addSamples(texts, "instagram-comment").added;
    result.pairs += addPairs(pairs).added;
  } catch (error) {
    result.errors.push(`Komentarze: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const messages = await fetchConversationMessages(account.instagram_id, token);
    result.messages = addSamples(ownMessageTexts(messages, ownId), "instagram-dm").added;
    result.pairs += addPairs(ownMessagePairs(messages, ownId)).added;
  } catch (error) {
    result.errors.push(`Wiadomości: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
