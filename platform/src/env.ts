import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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

/**
 * Optional settings file, for hosts where entering variables one by one is awkward. It lives in the
 * account's home folder (~/keel.env), outside the website's public folder, so it can't be downloaded.
 * Variables set in cPanel take precedence over the file.
 */
export function loadEnvFile(path = process.env.KEEL_ENV_FILE || join(homedir(), "keel.env")): string | null {
  if (!existsSync(path)) return null;
  process.loadEnvFile(path);
  return path;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // One readable line per setting in the host's error log, never the values.
    const lines = parsed.error.issues.map(i => `  ${i.path.join(".")}: ${source[String(i.path[0])] === undefined ? "not set" : i.message}`);
    throw new Error(`Keel cannot start: fix these settings (cPanel → Setup Node.js App → Environment variables), then Restart.\n${lines.join("\n")}`);
  }
  const env = parsed.data;
  env.DATABASE_URL = normalizeDatabaseUrl(env.DATABASE_URL);
  env.GITHUB_PRIVATE_KEY = normalizePem(env.GITHUB_PRIVATE_KEY);
  return env;
}

/**
 * Accept a DATABASE_URL as people actually type it: a password with characters such as ; @ # / ?
 * is encoded, surrounding quotes are dropped, and localhost becomes 127.0.0.1 (cPanel's PostgreSQL
 * often accepts IPv4 only, while "localhost" may resolve to ::1). Errors name the problem, not the value.
 */
export function normalizeDatabaseUrl(raw: string): string {
  const url = raw.trim().replace(/^(["'])(.*)\1$/s, "$2");
  if (url.includes("host=/")) return url;   // a Unix-socket URL; leave it alone
  const m = url.match(/^(postgres(?:ql)?):\/\/([^:@/]+)(?::(.*))?@([^@/?:]+)(?::(\d+))?\/([^?#]+)(\?.*)?$/s);
  if (!m) throw new Error("Keel cannot start: DATABASE_URL must look like postgres://USER:PASSWORD@127.0.0.1:5432/DATABASE?sslmode=disable");
  const [, scheme, user, password, host, port, database, query] = m;
  if (/[<>]/.test(user + database)) throw new Error("Keel cannot start: DATABASE_URL still contains a <placeholder>; put in the real user and database name");
  const enc = (v: string) => { try { return encodeURIComponent(decodeURIComponent(v)); } catch { return encodeURIComponent(v); } };
  const h = host.toLowerCase() === "localhost" ? "127.0.0.1" : host;
  return `${scheme}://${enc(user)}${password === undefined ? "" : ":" + enc(password)}@${h}${port ? ":" + port : ""}/${enc(database)}${query ?? ""}`;
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
