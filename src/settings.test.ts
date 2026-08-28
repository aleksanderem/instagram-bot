import { describe, expect, it } from "vitest";
import { effectiveSettings, sanitizeSettingsPatch } from "./settings.js";

const envDefaults = {
  autoSendConfidentDrafts: false,
  openaiModel: "gpt-4.1-mini",
  allowedInstagramAccountIds: new Set(["111"])
};

describe("effectiveSettings", () => {
  it("falls back to env defaults when nothing is stored", () => {
    const effective = effectiveSettings(envDefaults, {});
    expect(effective.autoSendConfidentDrafts).toBe(false);
    expect(effective.openaiModel).toBe("gpt-4.1-mini");
    expect([...effective.allowedInstagramAccountIds]).toEqual(["111"]);
    expect(effective.toneNotes).toBe("");
  });

  it("stored values override env defaults", () => {
    const effective = effectiveSettings(envDefaults, {
      autoSendConfidentDrafts: true,
      openaiModel: "gpt-4.1",
      allowedInstagramAccountIds: ["222", "333"],
      toneNotes: "ciepło, konkretnie"
    });
    expect(effective.autoSendConfidentDrafts).toBe(true);
    expect(effective.openaiModel).toBe("gpt-4.1");
    expect([...effective.allowedInstagramAccountIds]).toEqual(["222", "333"]);
    expect(effective.toneNotes).toBe("ciepło, konkretnie");
  });
});

describe("sanitizeSettingsPatch", () => {
  it("accepts a valid partial patch", () => {
    expect(sanitizeSettingsPatch({ autoSendConfidentDrafts: true })).toEqual({ autoSendConfidentDrafts: true });
  });

  it("trims and drops empty account ids", () => {
    const patch = sanitizeSettingsPatch({ allowedInstagramAccountIds: [" 222 ", "", "333"] });
    expect(patch.allowedInstagramAccountIds).toEqual(["222", "333"]);
  });

  it("rejects unknown keys and wrong types", () => {
    expect(() => sanitizeSettingsPatch({ openaiModel: 42 })).toThrow();
    expect(() => sanitizeSettingsPatch({ nope: true })).toThrow();
  });

  it("caps tone notes length", () => {
    expect(() => sanitizeSettingsPatch({ toneNotes: "x".repeat(5001) })).toThrow();
  });
});
