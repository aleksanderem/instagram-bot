import { describe, expect, it } from "vitest";
import { parseShortLivedToken, parseWebhook } from "./meta.js";

describe("Instagram webhook parser", () => {
  it("extracts a DM", () => {
    expect(parseWebhook({ entry: [{ id: "ig-1", messaging: [{ sender: { id: "person-1" }, message: { mid: "m-1", text: "Dzień dobry" } }] }] })).toEqual([
      { externalId: "m-1", accountId: "ig-1", channel: "dm", senderId: "person-1", text: "Dzień dobry" }
    ]);
  });

  it("extracts a comment", () => {
    expect(parseWebhook({ entry: [{ id: "ig-1", changes: [{ field: "comments", value: { id: "c-1", text: "Super!", from: { id: "person-1" } } }] }] })).toEqual([
      { externalId: "c-1", accountId: "ig-1", channel: "comment", senderId: "person-1", text: "Super!", replyToId: "c-1" }
    ]);
  });
});

describe("short-lived token response", () => {
  it("reads the documented data[] shape returned by Instagram Business Login", () => {
    expect(
      parseShortLivedToken({ data: [{ access_token: "IGAA-short", user_id: 178414, permissions: "instagram_business_basic" }] })
    ).toEqual({ access_token: "IGAA-short", user_id: "178414" });
  });

  it("reads the flat shape", () => {
    expect(parseShortLivedToken({ access_token: "IGAA-short", user_id: "178414" })).toEqual({
      access_token: "IGAA-short",
      user_id: "178414"
    });
  });

  it("fails with a readable message when no token is present", () => {
    expect(() => parseShortLivedToken({ data: [] })).toThrow(/short-lived/i);
  });
});

describe("parseWebhook — kontekst posta", () => {
  it("keeps the id of the post a comment sits under", () => {
    const [event] = parseWebhook({
      entry: [{ id: "ig-1", changes: [{ field: "comments", value: { id: "c-1", text: "Przy ADHD nic nie daje XD", from: { id: "p-1" }, media: { id: "media-9" } } }] }]
    });
    expect(event.mediaId).toBe("media-9");
  });

  it("still works when Instagram sends no post information", () => {
    const [event] = parseWebhook({
      entry: [{ id: "ig-1", changes: [{ field: "comments", value: { id: "c-1", text: "Super!", from: { id: "p-1" } } }] }]
    });
    expect(event.mediaId).toBeUndefined();
  });
});
