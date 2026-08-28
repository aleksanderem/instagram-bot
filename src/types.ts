export type Channel = "dm" | "comment";
export type ReviewStatus = "pending" | "approved" | "rejected" | "sent" | "escalated";

export interface InboundEvent {
  externalId: string;
  accountId: string;
  channel: Channel;
  senderId: string;
  text: string;
  replyToId?: string;
}

export interface Draft {
  text: string;
  shouldEscalate: boolean;
  reason?: string;
  confidence: "high" | "medium" | "low";
}
