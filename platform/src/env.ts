import { z } from "zod";

// All configuration comes from environment variables (set in cPanel → Setup Node.js App).
const schema = z.object({
  NODE_ENV: z.string().default("production"),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default("https://keel.boraqs.com"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default("keel-repair"),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GITHUB_PRIVATE_KEY: z.string().default(""),
  GITHUB_WEBHOOK_SECRET: z.string().default(""),
  OIDC_AUDIENCE: z.string().default("keel.boraqs.com"),
  KEEL_ACTION_REF: z.string().default("feedofmri/keel@v1"),
  // Overridable for tests against a fake GitHub; leave unset in production.
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  GITHUB_WEB_URL: z.string().url().default("https://github.com"),
  RATE_LIMIT: z.enum(["on", "off"]).default("on"),
  // Data retention (see db/retention.ts). Kept short to keep a free service's database small.
  RETENTION_RUN_DETAIL_DAYS: z.coerce.number().int().min(7).default(90),
  RETENTION_RUN_DAYS: z.coerce.number().int().min(30).default(365),
  RETENTION_ACTIVITY_DAYS: z.coerce.number().int().min(7).default(90),
});

export type Env = z.infer<typeof schema>;

export const retentionOf = (env: Env) =>
  ({ runDetailDays: env.RETENTION_RUN_DETAIL_DAYS, runDays: env.RETENTION_RUN_DAYS, auditDays: env.RETENTION_ACTIVITY_DAYS });

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  env.GITHUB_PRIVATE_KEY = normalizePem(env.GITHUB_PRIVATE_KEY);
  return env;
}

/**
 * cPanel's environment editor is a one-line field, so a pasted PEM key arrives with its line breaks
 * escaped as "\n", turned into spaces, or dropped. Rebuild a valid PEM from any of these.
 */
export function normalizePem(key: string): string {
  const k = key.trim().replace(/\\n/g, "\n");
  const m = k.match(/^(-----BEGIN [A-Z ]+-----)([\s\S]*?)(-----END [A-Z ]+-----)$/);
  if (!m) return k;
  const body = m[2].replace(/\s+/g, "");
  return `${m[1]}\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n${m[3]}\n`;
}

export const githubConfigured = (env: Env) =>
  Boolean(env.GITHUB_APP_ID && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_PRIVATE_KEY);
