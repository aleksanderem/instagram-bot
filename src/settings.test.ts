import { describe, expect, it } from "vitest";
import { effectiveSettings, sanitizeSettingsPatch } from "./settings.js";

const envDefaults = {
  autoSendConfidentDrafts: false,
  aiModel: "MiniMax-M3",
  allowedInstagramAccountIds: new Set(["111"])
};

describe("effectiveSettings", () => {
  it("falls back to env defaults when nothing is stored", () => {
    const effective = effectiveSettings(envDefaults, {});
    expect(effective.autoSendConfidentDrafts).toBe(false);
    expect(effective.aiModel).toBe("MiniMax-M3");
    expect([...effective.allowedInstagramAccountIds]).toEqual(["111"]);
    expect(effective.toneNotes).toBe("");
    expect(effective.respondToDms).toBe(true);
    expect(effective.respondToComments).toBe(true);
  });

  it("stored values override env defaults", () => {
    const effective = effectiveSettings(envDefaults, {
      autoSendConfidentDrafts: true,
      aiModel: "MiniMax-M2",
      allowedInstagramAccountIds: ["222", "333"],
      toneNotes: "ciepło, konkretnie",
      respondToDms: true,
      respondToComments: false
    });
    expect(effective.autoSendConfidentDrafts).toBe(true);
    expect(effective.aiModel).toBe("MiniMax-M2");
    expect([...effective.allowedInstagramAccountIds]).toEqual(["222", "333"]);
    expect(effective.toneNotes).toBe("ciepło, konkretnie");
    expect(effective.respondToComments).toBe(false);
  });
});

describe("sanitizeSettingsPatch", () => {
  it("accepts a valid partial patch", () => {
    expect(sanitizeSettingsPatch({ respondToComments: false })).toEqual({ respondToComments: false });
  });

  it("trims and drops empty account ids", () => {
    const patch = sanitizeSettingsPatch({ allowedInstagramAccountIds: [" 222 ", "", "333"] });
    expect(patch.allowedInstagramAccountIds).toEqual(["222", "333"]);
  });

  it("rejects unknown keys and wrong types", () => {
    expect(() => sanitizeSettingsPatch({ aiModel: 42 })).toThrow();
    expect(() => sanitizeSettingsPatch({ nope: true })).toThrow();
  });

  it("caps tone notes length", () => {
    expect(() => sanitizeSettingsPatch({ toneNotes: "x".repeat(5001) })).toThrow();
  });
});
