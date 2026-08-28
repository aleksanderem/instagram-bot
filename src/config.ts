import "dotenv/config";
import { z } from "zod";

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    APP_BASE_URL: z.string().url().optional(),
    DATABASE_PATH: z.string().default("./data/instagram-copilot.json"),
    META_VERIFY_TOKEN: z.string().min(16).optional(),
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    META_GRAPH_API_VERSION: z.string().default("v23.0"),
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
    BRAND_CONTEXT_PATH: z.string().default("./brand.md"),
    ADMIN_API_KEY: z.string().min(24).optional(),
    AUTO_SEND_CONFIDENT_DRAFTS: z.enum(["true", "false"]).default("false"),
    ALLOWED_INSTAGRAM_ACCOUNT_IDS: z.string().default("")
  })
  .parse(process.env);

export const config = {
  ...env,
  autoSendConfidentDrafts: env.AUTO_SEND_CONFIDENT_DRAFTS === "true",
  allowedInstagramAccountIds: new Set(
    env.ALLOWED_INSTAGRAM_ACCOUNT_IDS.split(",").map((value) => value.trim()).filter(Boolean)
  )
};

export function hasMetaOAuthConfig() {
  return Boolean(config.APP_BASE_URL && config.META_APP_ID && config.META_APP_SECRET);
}

export function hasEncryptionKey() {
  return Boolean(config.TOKEN_ENCRYPTION_KEY);
}
