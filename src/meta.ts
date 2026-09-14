import { config, hasMetaOAuthConfig } from "./config.js";
import type { InboundEvent } from "./types.js";

const graphBase = () => `https://graph.instagram.com/${config.META_GRAPH_API_VERSION}`;

export function buildAuthorizationUrl(state: string) {
  if (!hasMetaOAuthConfig()) throw new Error("Meta OAuth is not configured.");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.META_APP_ID!);
  url.searchParams.set("redirect_uri", `${config.APP_BASE_URL}/auth/instagram/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments"
  );
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string) {
  if (!hasMetaOAuthConfig()) throw new Error("Meta OAuth is not configured.");
  const body = new URLSearchParams({
    client_id: config.META_APP_ID!,
    client_secret: config.META_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: `${config.APP_BASE_URL}/auth/instagram/callback`,
    code
  });
  const response = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body });
  if (!response.ok) throw new Error(`Meta OAuth failed: ${await response.text()}`);
  const shortLived = parseShortLivedToken(await response.json());
  console.log("Instagram short-lived token received", describeToken(shortLived.access_token));
  return exchangeForLongLivedToken(shortLived.access_token);
}

/**
 * The documented exchange (GET graph.instagram.com/access_token) intermittently
 * answered "Unsupported request"; the identical call succeeded minutes later,
 * so a single retry against the versioned path guards against that.
 */
async function exchangeForLongLivedToken(token: string) {
  const query = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config.META_APP_SECRET!,
    access_token: token
  });
  const attempts = [
    { name: "graph.instagram.com/access_token", url: `https://graph.instagram.com/access_token?${query}` },
    { name: `graph.instagram.com/${config.META_GRAPH_API_VERSION}/access_token`, url: `${graphBase()}/access_token?${query}` }
  ];

  const failures: string[] = [];
  for (const attempt of attempts) {
    const response = await fetch(attempt.url);
    if (response.ok) {
      console.log("Instagram long-lived token obtained", { via: attempt.name });
      return (await response.json()) as { access_token: string; user_id?: string };
    }
    const detail = redactSecrets(await response.text(), token).slice(0, 160);
    failures.push(`${attempt.name} -> ${response.status} ${detail}`);
  }
  console.error("Instagram long-lived exchange failed", { attempts: failures });
  throw new Error(`Meta token exchange failed: ${failures.join(" | ")}`);
}

/**
 * Instagram Business Login wraps the short-lived token in a `data` array,
 * while the older flow returned it flat. Accept both and fail loudly otherwise.
 */
export function parseShortLivedToken(payload: unknown): { access_token: string; user_id?: string } {
  const record = payload as { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  const entry = Array.isArray(record?.data) ? record.data[0] : record;
  const accessToken = entry?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error(`Instagram returned no short-lived access token (keys: ${Object.keys(record ?? {}).join(",") || "none"})`);
  }
  const userId = entry?.user_id;
  return userId === undefined || userId === null
    ? { access_token: accessToken }
    : { access_token: accessToken, user_id: String(userId) };
}

/** Tell Instagram to deliver this account's messages and comments to our webhook. */
export async function subscribeToWebhooks(accountId: string, accessToken: string) {
  const url = new URL(`${graphBase()}/${accountId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "messages,comments");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "POST" });
  const body = redactSecrets(await response.text(), accessToken).slice(0, 200);
  if (!response.ok) throw new Error(`Instagram webhook subscription failed: ${body}`);
  return body;
}

const redactSecrets = (text: string, token: string) =>
  text
    .replaceAll(config.META_APP_SECRET ?? "\u0000", "<secret>")
    .replaceAll(token, "<token>")
    .replace(/(access_token|client_secret)=[^&\s"]+/g, "$1=<redacted>");

const describeToken = (token: string) => ({ length: token.length, prefix: token.slice(0, 6) });

export async function getInstagramAccount(accessToken: string) {
  const url = new URL(`${graphBase()}/me`);
  url.searchParams.set("fields", "id,user_id,username");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read Instagram account: ${await response.text()}`);
  return (await response.json()) as { id: string; user_id?: string; username?: string };
}

export async function sendMessage(accountId: string, recipientId: string, text: string, accessToken: string) {
  return metaPost(`${graphBase()}/${accountId}/messages`, accessToken, {
    recipient: { id: recipientId },
    message: { text }
  });
}

export async function replyToComment(commentId: string, text: string, accessToken: string) {
  return metaPost(`${graphBase()}/${commentId}/replies`, accessToken, { message: text });
}

async function metaPost(url: string, accessToken: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Meta request failed: ${await response.text()}`);
  return response.json();
}

async function metaGet(url: URL, accessToken: string) {
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta request failed: ${await response.text()}`);
  return response.json() as Promise<{ data?: Array<Record<string, any>> }>;
}

export async function fetchOwnMedia(accessToken: string) {
  const url = new URL(`${graphBase()}/me/media`);
  url.searchParams.set("fields", "id,caption,media_type,timestamp");
  url.searchParams.set("limit", "50");
  const { data } = await metaGet(url, accessToken);
  return (data ?? []).map((item) => ({ id: String(item.id), caption: typeof item.caption === "string" ? item.caption : "" }));
}

export async function fetchMediaComments(mediaId: string, accessToken: string) {
  const url = new URL(`${graphBase()}/${mediaId}/comments`);
  url.searchParams.set("fields", "id,text,from,username,parent_id,replies{id,text,from,username}");
  url.searchParams.set("limit", "50");
  const { data } = await metaGet(url, accessToken);
  return data ?? [];
}

export async function fetchConversationMessages(accountId: string, accessToken: string) {
  const conversationsUrl = new URL(`${graphBase()}/${accountId}/conversations`);
  conversationsUrl.searchParams.set("fields", "id");
  conversationsUrl.searchParams.set("limit", "20");
  const { data } = await metaGet(conversationsUrl, accessToken);
  const messages: Array<Record<string, any>> = [];
  for (const conversation of data ?? []) {
    const messagesUrl = new URL(`${graphBase()}/${String(conversation.id)}/messages`);
    messagesUrl.searchParams.set("fields", "id,from,message,created_time");
    messagesUrl.searchParams.set("limit", "50");
    const page = await metaGet(messagesUrl, accessToken);
    messages.push(...(page.data ?? []));
  }
  return messages;
}

export function parseWebhook(payload: unknown): InboundEvent[] {
  const body = payload as { entry?: Array<Record<string, unknown>> };
  const events: InboundEvent[] = [];
  for (const entry of body.entry ?? []) {
    const accountId = String(entry.id ?? "");
    for (const item of (entry.messaging as Array<Record<string, any>> | undefined) ?? []) {
      const text = item.message?.text;
      const senderId = item.sender?.id;
      const mid = item.message?.mid;
      if (text && senderId && mid) {
        events.push({ externalId: String(mid), accountId, channel: "dm", senderId: String(senderId), text: String(text) });
      }
    }
    for (const change of (entry.changes as Array<Record<string, any>> | undefined) ?? []) {
      if (change.field !== "comments") continue;
      const value = change.value ?? {};
      const commentId = value.id ?? value.comment_id;
      const text = value.text;
      const senderId = value.from?.id ?? value.from?.username;
      if (commentId && text && senderId) {
        events.push({
          externalId: String(commentId),
          accountId,
          channel: "comment",
          senderId: String(senderId),
          text: String(text),
          replyToId: String(commentId)
        });
      }
    }
  }
  return events;
}
