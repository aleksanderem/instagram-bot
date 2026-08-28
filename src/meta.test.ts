import { describe, expect, it } from "vitest";
import { parseWebhook } from "./meta.js";

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
