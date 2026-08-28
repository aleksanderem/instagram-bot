import { z } from "zod";

export type StoredSettings = {
  autoSendConfidentDrafts?: boolean;
  openaiModel?: string;
  allowedInstagramAccountIds?: string[];
  toneNotes?: string;
};

export type SettingsEnvDefaults = {
  autoSendConfidentDrafts: boolean;
  openaiModel: string;
  allowedInstagramAccountIds: Set<string>;
};

export type EffectiveSettings = {
  autoSendConfidentDrafts: boolean;
  openaiModel: string;
  allowedInstagramAccountIds: Set<string>;
  toneNotes: string;
};

const settingsPatchSchema = z
  .object({
    autoSendConfidentDrafts: z.boolean(),
    openaiModel: z.string().min(1).max(100),
    allowedInstagramAccountIds: z.array(z.string().max(64)),
    toneNotes: z.string().max(5000)
  })
  .partial()
  .strict();

export function sanitizeSettingsPatch(input: unknown): StoredSettings {
  const patch = settingsPatchSchema.parse(input);
  if (patch.allowedInstagramAccountIds) {
    return {
      ...patch,
      allowedInstagramAccountIds: patch.allowedInstagramAccountIds.map((id) => id.trim()).filter(Boolean)
    };
  }
  return patch;
}

export function effectiveSettings(env: SettingsEnvDefaults, stored: StoredSettings): EffectiveSettings {
  return {
    autoSendConfidentDrafts: stored.autoSendConfidentDrafts ?? env.autoSendConfidentDrafts,
    openaiModel: stored.openaiModel ?? env.openaiModel,
    allowedInstagramAccountIds: stored.allowedInstagramAccountIds
      ? new Set(stored.allowedInstagramAccountIds)
      : env.allowedInstagramAccountIds,
    toneNotes: stored.toneNotes ?? ""
  };
}
