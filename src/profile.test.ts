import { describe, expect, it } from "vitest";
import { buildProfilePrompt } from "./profile.js";

describe("buildProfilePrompt", () => {
  it("includes every sample, numbered", () => {
    const prompt = buildProfilePrompt(["Dzień dobry, czy macie wolne terminy?", "Ile kosztuje konsultacja?"], "", "");
    expect(prompt).toContain("1. Dzień dobry, czy macie wolne terminy?");
    expect(prompt).toContain("2. Ile kosztuje konsultacja?");
  });

  it("includes tone notes and current profile when provided", () => {
    const prompt = buildProfilePrompt(["abc"], "ciepło, bez wykrzykników", "# Stary profil");
    expect(prompt).toContain("ciepło, bez wykrzykników");
    expect(prompt).toContain("# Stary profil");
  });

  it("throws when there are no samples", () => {
    expect(() => buildProfilePrompt([], "", "")).toThrow();
  });
});
