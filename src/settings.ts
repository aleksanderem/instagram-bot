import { z } from "zod";

export type StoredSettings = {
  autoSendConfidentDrafts?: boolean;
  aiModel?: string;
  allowedInstagramAccountIds?: string[];
  toneNotes?: string;
  respondToDms?: boolean;
  respondToComments?: boolean;
};

export type SettingsEnvDefaults = {
  autoSendConfidentDrafts: boolean;
  aiModel: string;
  allowedInstagramAccountIds: Set<string>;
};

export type EffectiveSettings = {
  autoSendConfidentDrafts: boolean;
  aiModel: string;
  allowedInstagramAccountIds: Set<string>;
  toneNotes: string;
  respondToDms: boolean;
  respondToComments: boolean;
};

const settingsPatchSchema = z
  .object({
    autoSendConfidentDrafts: z.boolean(),
    aiModel: z.string().min(1).max(100),
    allowedInstagramAccountIds: z.array(z.string().max(64)),
    toneNotes: z.string().max(5000),
    respondToDms: z.boolean(),
    respondToComments: z.boolean()
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
    aiModel: stored.aiModel ?? env.aiModel,
    allowedInstagramAccountIds: stored.allowedInstagramAccountIds
      ? new Set(stored.allowedInstagramAccountIds)
      : env.allowedInstagramAccountIds,
    toneNotes: stored.toneNotes ?? "",
    respondToDms: stored.respondToDms ?? true,
    respondToComments: stored.respondToComments ?? true
  };
}
