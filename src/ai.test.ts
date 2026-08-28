import { describe, expect, it } from "vitest";
import { extractChatText, parseDraftJson } from "./ai.js";

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
