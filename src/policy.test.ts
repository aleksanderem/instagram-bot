import { describe, expect, it } from "vitest";
import { requiresHuman, validateDraft, isProvocative } from "./policy.js";

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

describe("isProvocative", () => {
  it("catches a sexual innuendo dressed up as a drug reference", () => {
    expect(isProvocative("Przecież lubiłaś się grzać po mefedronie")).toBe(true);
  });

  it("catches a direct sexual taunt", () => {
    expect(isProvocative("A ile chłopa miałaś na chemsexie")).toBe(true);
  });

  it("leaves an ordinary question alone", () => {
    expect(isProvocative("Ile trwa konsultacja i czy da się online?")).toBe(false);
  });

  it("leaves a serious question about addiction alone", () => {
    expect(isProvocative("Biorę mefedron od roku i chcę przestać, od czego zacząć?")).toBe(false);
  });
});
