import { describe, expect, it } from "vitest";
import { ownCommentPairs, ownCommentTexts, ownContentId, ownMessagePairs, ownMessageTexts } from "./ingest.js";

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

describe("ownContentId", () => {
  it("uses the Instagram user id that signs the account's own posts and replies", () => {
    expect(ownContentId({ instagram_id: "28223724180619255", ig_user_id: "17841464783600697" })).toBe("17841464783600697");
  });

  it("falls back to the stored id when the user id is not known yet", () => {
    expect(ownContentId({ instagram_id: "28223724180619255", ig_user_id: null })).toBe("28223724180619255");
  });
});

describe("ownCommentPairs", () => {
  it("pairs a stranger's comment with the reply the account wrote under it", () => {
    const comments = [
      {
        text: "Przecież lubiłaś się grzać po mefedronie",
        from: { id: "999" },
        replies: { data: [{ text: "Nie komentuję takich sugestii.", from: { id: ACCOUNT } }] }
      }
    ];
    expect(ownCommentPairs(comments, ACCOUNT)).toEqual([
      { question: "Przecież lubiłaś się grzać po mefedronie", answer: "Nie komentuję takich sugestii.", source: "instagram-comment" }
    ]);
  });

  it("skips comments the account wrote itself and ones it never answered", () => {
    const comments = [
      { text: "Nasz post", from: { id: ACCOUNT } },
      { text: "Pytanie bez odpowiedzi", from: { id: "999" } }
    ];
    expect(ownCommentPairs(comments, ACCOUNT)).toEqual([]);
  });
});

describe("ownMessagePairs", () => {
  it("pairs each reply with the message it answered, oldest first", () => {
    const messages = [
      { from: { id: ACCOUNT }, message: "Napisz proszę prywatnie.", created_time: "2026-09-14T10:00:02+0000" },
      { from: { id: "999" }, message: "Ile kosztuje konsultacja?", created_time: "2026-09-14T10:00:01+0000" }
    ];
    expect(ownMessagePairs(messages, ACCOUNT)).toEqual([
      { question: "Ile kosztuje konsultacja?", answer: "Napisz proszę prywatnie.", source: "instagram-dm" }
    ]);
  });

  it("joins a reply split across several messages", () => {
    const messages = [
      { from: { id: "999" }, message: "Jak długo trwa detoks?", created_time: "2026-09-14T10:00:01+0000" },
      { from: { id: ACCOUNT }, message: "To zależy.", created_time: "2026-09-14T10:00:02+0000" },
      { from: { id: ACCOUNT }, message: "Opowiem prywatnie.", created_time: "2026-09-14T10:00:03+0000" }
    ];
    expect(ownMessagePairs(messages, ACCOUNT)).toEqual([
      { question: "Jak długo trwa detoks?", answer: "To zależy.\nOpowiem prywatnie.", source: "instagram-dm" }
    ]);
  });

  it("ignores the account writing first with nothing to answer", () => {
    expect(ownMessagePairs([{ from: { id: ACCOUNT }, message: "Cześć!", created_time: "2026-09-14T10:00:01+0000" }], ACCOUNT)).toEqual([]);
  });
});

describe("ownCommentPairs — odpowiedzi wskazane przez parent_id", () => {
  it("pairs our reply with the comment it points at", () => {
    const comments = [
      { id: "c1", text: "Przecież lubiłaś się grzać po mefedronie", from: { id: "999" } },
      { id: "c2", parent_id: "c1", text: "@ktos Nie komentuję takich sugestii.", from: { id: ACCOUNT } }
    ];
    expect(ownCommentPairs(comments, ACCOUNT)).toEqual([
      { question: "Przecież lubiłaś się grzać po mefedronie", answer: "Nie komentuję takich sugestii.", source: "instagram-comment" }
    ]);
  });

  it("ignores a reply whose parent is our own comment", () => {
    const comments = [
      { id: "c1", text: "Nasz komentarz", from: { id: ACCOUNT } },
      { id: "c2", parent_id: "c1", text: "@ktos dzięki", from: { id: ACCOUNT } }
    ];
    expect(ownCommentPairs(comments, ACCOUNT)).toEqual([]);
  });

  it("drops answers that carry no words", () => {
    const comments = [
      { id: "c1", text: "Świetny profil, gratuluję", from: { id: "999" } },
      { id: "c2", parent_id: "c1", text: "🤣🤣🤣", from: { id: ACCOUNT } }
    ];
    expect(ownCommentPairs(comments, ACCOUNT)).toEqual([]);
  });
});
