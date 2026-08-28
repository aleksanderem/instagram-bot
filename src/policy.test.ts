import { describe, expect, it } from "vitest";
import { requiresHuman, validateDraft } from "./policy.js";

describe("tone and safety policy", () => {
  it("routes sensitive cases to a human", () => {
    expect(requiresHuman("Chcę złożyć reklamację za zamówienie.")).toBeTruthy();
  });

  it("rejects absolute promises", () => {
    expect(validateDraft("Na pewno dostarczymy jutro.", "dm")).toBeTruthy();
  });

  it("allows a short, neutral comment response", () => {
    expect(validateDraft("Dziękujemy za komentarz!", "comment")).toBeUndefined();
  });
});
