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
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  // cPanel's env editor stores multi-line values poorly: accept "\n"-escaped PEM keys.
  if (env.GITHUB_PRIVATE_KEY.includes("\\n")) env.GITHUB_PRIVATE_KEY = env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  return env;
}

export const githubConfigured = (env: Env) =>
  Boolean(env.GITHUB_APP_ID && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_PRIVATE_KEY);
