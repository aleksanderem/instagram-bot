import { decrypt } from "./crypto.js";
import { addSamples, getAccount } from "./db.js";
import { fetchConversationMessages, fetchMediaComments, fetchOwnMedia } from "./meta.js";

type CommentNode = { text?: unknown; from?: { id?: unknown }; replies?: { data?: CommentNode[] } };
type MessageNode = { from?: { id?: unknown }; message?: unknown };

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

export type ImportResult = {
  posts: number;
  comments: number;
  messages: number;
  errors: string[];
};

const MAX_MEDIA_FOR_COMMENTS = 25;

export async function importAccountContent(accountId: string): Promise<ImportResult> {
  const account = getAccount(accountId);
  if (!account) throw new Error("Instagram account is not connected.");
  const token = decrypt(account.encrypted_access_token);
  const result: ImportResult = { posts: 0, comments: 0, messages: 0, errors: [] };

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
    for (const mediaId of mediaIds.slice(0, MAX_MEDIA_FOR_COMMENTS)) {
      texts.push(...ownCommentTexts(await fetchMediaComments(mediaId, token), accountId));
    }
    result.comments = addSamples(texts, "instagram-comment").added;
  } catch (error) {
    result.errors.push(`Komentarze: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const messages = await fetchConversationMessages(accountId, token);
    result.messages = addSamples(ownMessageTexts(messages, accountId), "instagram-dm").added;
  } catch (error) {
    result.errors.push(`Wiadomości: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}
