import { decrypt } from "./crypto.js";
import { addPairs, addSamples, getAccount, upsertAccount } from "./db.js";
import { fetchConversationMessages, fetchMediaComments, fetchOwnMedia, getInstagramAccount } from "./meta.js";
import type { ConversationPair } from "./types.js";

type CommentNode = { text?: unknown; from?: { id?: unknown }; replies?: { data?: CommentNode[] } };
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

/** Comments from other people together with the reply the account wrote underneath. */
export function ownCommentPairs(comments: CommentNode[], accountId: string): ConversationPair[] {
  const pairs: ConversationPair[] = [];
  for (const comment of comments) {
    const question = cleanText(comment.text);
    if (!question || String(comment.from?.id ?? "") === accountId) continue;
    for (const reply of comment.replies?.data ?? []) {
      const answer = cleanText(reply.text);
      if (answer && String(reply.from?.id ?? "") === accountId) {
        pairs.push({ question, answer, source: "instagram-comment" });
      }
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
      reply.push(text);
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

const MAX_MEDIA_FOR_COMMENTS = 25;

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
