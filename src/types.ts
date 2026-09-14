export type Channel = "dm" | "comment";
export type ReviewStatus = "pending" | "approved" | "rejected" | "sent" | "escalated";

export interface InboundEvent {
  externalId: string;
  accountId: string;
  channel: Channel;
  senderId: string;
  text: string;
  replyToId?: string;
  /** The post a comment sits under; a comment read without it can be answered dangerously. */
  mediaId?: string;
}

export interface Draft {
  text: string;
  shouldEscalate: boolean;
  reason?: string;
  confidence: "high" | "medium" | "low";
}

/** A message or comment the brand received, together with the reply it wrote back. */
export type ConversationPair = { question: string; answer: string; source: string };
