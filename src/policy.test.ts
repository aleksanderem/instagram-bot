import { describe, expect, it } from "vitest";
import { holdReason, isProvocative, needsHumanApproval, parseRiskAssessment, requiresHuman, validateDraft } from "./policy.js";

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

describe("needsHumanApproval", () => {
  it("holds back a taunt", () => {
    expect(needsHumanApproval("Przecież lubiłaś się grzać po mefedronie")).toMatch(/zaczepk/i);
  });

  it("holds back talk about doses and how to take something", () => {
    expect(needsHumanApproval("pusty żołądek, godzinę przed 100 kamy i lecisz 😅")).toMatch(/substancj/i);
    expect(needsHumanApproval("ile trzeba wziąć żeby coś poczuć?")).toMatch(/substancj/i);
  });

  it("holds back claims that nothing works, which invite a dosing answer", () => {
    expect(needsHumanApproval("Przy ADHD nic nie daje XD")).toMatch(/substancj/i);
  });

  it("lets an ordinary question through", () => {
    expect(needsHumanApproval("Czy jest możliwa konsultacja online i ile kosztuje?")).toBeUndefined();
  });
});

describe("parseRiskAssessment", () => {
  it("reads the model's verdict", () => {
    expect(parseRiskAssessment('{"taunt": false, "substanceUse": true, "reason": "ocena jakości narkotyku"}')).toEqual({
      taunt: false,
      substanceUse: true,
      reason: "ocena jakości narkotyku",
      failed: false
    });
  });

  it("tolerates fences and prose around the JSON", () => {
    expect(parseRiskAssessment('```json\n{"taunt": true, "substanceUse": false, "reason": null}\n```').taunt).toBe(true);
  });

  it("fails closed on anything it cannot read", () => {
    expect(parseRiskAssessment("nie wiem").failed).toBe(true);
    expect(parseRiskAssessment('{"taunt": "tak"}').failed).toBe(true);
  });
});

describe("holdReason", () => {
  const clean = { taunt: false, substanceUse: false, reason: null, failed: false };

  it("holds what the model flags even when no keyword matches", () => {
    expect(holdReason("Mefedron: narkotyki dla ubogich 😂", { ...clean, substanceUse: true, reason: "żart o cenie narkotyku" })).toMatch(/substancj/i);
    expect(holdReason("*sildenafil istnieje*", { ...clean, substanceUse: true, reason: null })).toMatch(/substancj/i);
  });

  it("holds a taunt the model recognises", () => {
    expect(holdReason("Xc", { ...clean, taunt: true, reason: null })).toMatch(/zaczepk/i);
  });

  it("keeps keywords as a floor the model cannot lower", () => {
    expect(holdReason("Przecież lubiłaś się grzać po mefedronie", clean)).toMatch(/zaczepk/i);
  });

  it("holds when the assessment failed", () => {
    expect(holdReason("Świetny profil", { ...clean, failed: true })).toMatch(/oceni/i);
  });

  it("lets an ordinary comment through when both agree it is safe", () => {
    expect(holdReason("Czy jest możliwa konsultacja online?", clean)).toBeUndefined();
  });
});
