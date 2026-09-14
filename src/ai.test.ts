import { describe, expect, it } from "vitest";
import { buildDraftMessages, extractChatText, parseDraftJson } from "./ai.js";

describe("extractChatText", () => {
  it("reads the first choice's message content", () => {
    expect(extractChatText({ choices: [{ message: { content: '{"text":"Dziękujemy!"}' } }] })).toBe(
      '{"text":"Dziękujemy!"}'
    );
  });

  it("strips a <think> block from reasoning models", () => {
    const content = "<think>rozważam ton odpowiedzi</think>\n{\"text\":\"Cześć!\"}";
    expect(extractChatText({ choices: [{ message: { content } }] })).toBe('{"text":"Cześć!"}');
  });

  it("returns an empty string when there is no content", () => {
    expect(extractChatText({ choices: [] })).toBe("");
    expect(extractChatText({})).toBe("");
    expect(extractChatText({ choices: [{ message: { content: null } }] })).toBe("");
  });
});

describe("parseDraftJson", () => {
  it("parses a plain JSON object", () => {
    const draft = parseDraftJson('{"text":"Hej","shouldEscalate":false,"reason":null,"confidence":"high"}');
    expect(draft.text).toBe("Hej");
    expect(draft.confidence).toBe("high");
  });

  it("parses JSON wrapped in a markdown fence", () => {
    const draft = parseDraftJson('```json\n{"text":"Hej","shouldEscalate":false,"reason":null,"confidence":"low"}\n```');
    expect(draft.text).toBe("Hej");
  });

  it("throws when there is no JSON object", () => {
    expect(() => parseDraftJson("przepraszam, nie umiem")).toThrow();
  });
});

describe("buildDraftMessages", () => {
  const pairs = [
    {
      question: "Przecież lubiłaś się grzać po mefedronie",
      answer: "Nie komentuję takich sugestii.",
      source: "instagram-comment"
    }
  ];

  it("shows the model how similar messages were answered before", () => {
    const prompt = buildDraftMessages("lubiłaś grzanie mefedronem?", "comment", pairs, "księga").map((m) => m.content).join("\n");
    expect(prompt).toContain("Nie komentuję takich sugestii.");
  });

  it("adds the no-confirmation rule when the message is a taunt", () => {
    const prompt = buildDraftMessages("Przecież lubiłaś się grzać po mefedronie", "comment", [], "księga").map((m) => m.content).join("\n");
    expect(prompt).toMatch(/nie potwierdzaj/i);
  });

  it("leaves an ordinary question without the taunt rule", () => {
    const prompt = buildDraftMessages("Ile trwa konsultacja?", "comment", [], "księga").map((m) => m.content).join("\n");
    expect(prompt).not.toMatch(/nie potwierdzaj/i);
  });

  it("carries the brand book and the message itself", () => {
    const prompt = buildDraftMessages("Ile trwa konsultacja?", "dm", [], "TRESC KSIEGI").map((m) => m.content).join("\n");
    expect(prompt).toContain("TRESC KSIEGI");
    expect(prompt).toContain("Ile trwa konsultacja?");
  });
});
