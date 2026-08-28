import { describe, expect, it } from "vitest";
import { ownCommentTexts, ownMessageTexts } from "./ingest.js";

const ACCOUNT = "17841400000000000";

describe("ownCommentTexts", () => {
  it("keeps only comments and replies authored by the account", () => {
    const comments = [
      { text: "Świetny zabieg!", from: { id: "999" } },
      {
        text: "Dziękujemy! Zapraszamy ponownie.",
        from: { id: ACCOUNT },
        replies: { data: [{ text: "Do zobaczenia!", from: { id: ACCOUNT } }, { text: "Super", from: { id: "999" } }] }
      }
    ];
    expect(ownCommentTexts(comments, ACCOUNT)).toEqual(["Dziękujemy! Zapraszamy ponownie.", "Do zobaczenia!"]);
  });

  it("ignores empty and non-string texts", () => {
    expect(ownCommentTexts([{ text: "  ", from: { id: ACCOUNT } }, { from: { id: ACCOUNT } }], ACCOUNT)).toEqual([]);
  });
});

describe("ownMessageTexts", () => {
  it("keeps only messages sent by the account", () => {
    const messages = [
      { from: { id: "999" }, message: "Czy macie wolne terminy?" },
      { from: { id: ACCOUNT }, message: "Tak, zapraszamy w sobotę o 12:00." },
      { from: { id: ACCOUNT }, message: "" }
    ];
    expect(ownMessageTexts(messages, ACCOUNT)).toEqual(["Tak, zapraszamy w sobotę o 12:00."]);
  });
});
