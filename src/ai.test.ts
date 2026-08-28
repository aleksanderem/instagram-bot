import { describe, expect, it } from "vitest";
import { extractOutputText } from "./ai.js";

describe("extractOutputText", () => {
  it("reads text from the raw Responses API output array", () => {
    const payload = {
      output: [
        { type: "reasoning", content: [] },
        { type: "message", content: [{ type: "output_text", text: '{"text":"Dziękujemy!"}' }] }
      ]
    };
    expect(extractOutputText(payload)).toBe('{"text":"Dziękujemy!"}');
  });

  it("joins multiple output_text parts in order", () => {
    const payload = {
      output: [
        { type: "message", content: [{ type: "output_text", text: "{" }, { type: "output_text", text: "}" }] }
      ]
    };
    expect(extractOutputText(payload)).toBe("{}");
  });

  it("prefers a top-level output_text when present", () => {
    expect(extractOutputText({ output_text: "abc", output: [] })).toBe("abc");
  });

  it("returns an empty string when there is no text output", () => {
    expect(extractOutputText({ output: [{ type: "reasoning" }] })).toBe("");
    expect(extractOutputText({})).toBe("");
  });
});
