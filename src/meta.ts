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
  const shortLived = (await response.json()) as { access_token: string; user_id?: string };
  const longLivedUrl = new URL("https://graph.instagram.com/access_token");
  longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
  longLivedUrl.searchParams.set("client_secret", config.META_APP_SECRET!);
  longLivedUrl.searchParams.set("access_token", shortLived.access_token);
  const longLivedResponse = await fetch(longLivedUrl);
  if (!longLivedResponse.ok) throw new Error(`Meta token exchange failed: ${await longLivedResponse.text()}`);
  return (await longLivedResponse.json()) as { access_token: string; user_id?: string };
}

export async function getInstagramAccount(accessToken: string) {
  const url = new URL(`${graphBase()}/me`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read Instagram account: ${await response.text()}`);
  return (await response.json()) as { id: string; username?: string };
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
