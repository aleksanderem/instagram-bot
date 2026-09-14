import { describe, expect, it } from "vitest";
import { buildProfilePrompt } from "./profile.js";

const input = {
  replies: ["niespecjalnie :)", "na żywo też, zapraszam :)"],
  exchanges: [{ question: "Takie głupoty można opowiadać tylko w rolkach", answer: "na żywo też, zapraszam :)", source: "instagram-comment" }],
  posts: ["Zdrowienie to nie tylko usuwanie narkotyku z życia."],
  toneNotes: "",
  currentProfile: ""
};

describe("buildProfilePrompt", () => {
  it("numbers the replies that define how the brand talks", () => {
    const prompt = buildProfilePrompt(input);
    expect(prompt).toContain("1. niespecjalnie :)");
    expect(prompt).toContain("2. na żywo też, zapraszam :)");
  });

  it("shows real exchanges so the tone can be read from context", () => {
    const prompt = buildProfilePrompt(input);
    expect(prompt).toContain("Takie głupoty można opowiadać tylko w rolkach");
  });

  it("keeps posts apart and marks them as subject matter, not as voice", () => {
    const prompt = buildProfilePrompt(input);
    const postsAt = prompt.indexOf("Zdrowienie to nie tylko");
    const rulesAt = prompt.indexOf("Ton i styl wyznaczaj wyłącznie");
    expect(postsAt).toBeGreaterThan(-1);
    expect(rulesAt).toBeGreaterThan(-1);
    expect(prompt).toMatch(/posty[^\n]*(temat|wiedz)/i);
  });

  it("includes tone notes and the current profile when provided", () => {
    const prompt = buildProfilePrompt({ ...input, toneNotes: "bez wykrzykników", currentProfile: "# Stary profil" });
    expect(prompt).toContain("bez wykrzykników");
    expect(prompt).toContain("# Stary profil");
  });

  it("refuses to build a voice profile with no replies to read it from", () => {
    expect(() => buildProfilePrompt({ ...input, replies: [], exchanges: [] })).toThrow(/odpowiedz/i);
  });

  it("still works when there are replies but no posts", () => {
    expect(() => buildProfilePrompt({ ...input, posts: [] })).not.toThrow();
  });
});
