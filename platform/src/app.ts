import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import fstatic from "@fastify/static";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAccount } from "./account.js";
import { registerApi } from "./api.js";
import { registerInsights } from "./insights.js";
import { githubRefresher, registerAuth } from "./auth/github.js";
import { COOKIE, loadSession } from "./auth/sessions.js";
import type { Db } from "./db/index.js";
import type { Env } from "./env.js";
import { configureGitHub, GitHubError } from "./github/client.js";
import { registerWebhooks } from "./github/webhooks.js";
import { registerRunReports } from "./runs/report.js";

const here = dirname(fileURLToPath(import.meta.url));
let csp = "default-src 'self'";

export async function buildApp(db: Db, env: Env, opts: { jwks?: any; publicDir?: string } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== "test", trustProxy: true, bodyLimit: 512 * 1024 });
  configureGitHub(env);
  await app.register(cookie);
  // Per-IP limits: tight on sign-in, moderate on the API, generous for static files and GitHub webhooks.
  if (env.RATE_LIMIT === "on") await app.register(rateLimit, {
    timeWindow: "1 minute",
    max: req => (req.url.startsWith("/auth/") ? 30 : req.url.startsWith("/api/") ? 300 : 1200),
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, error: `Too many requests. Try again in ${Math.ceil(ctx.ttl / 1000)} seconds.` }),
  });
  await app.register(formbody);
  // Keep the raw JSON body (webhook signatures are computed over the exact bytes).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, body ? JSON.parse(body as string) : {}); } catch (e) { done(e as Error, undefined); }
  });
  app.decorateRequest("user", null);
  const refresh = githubRefresher(env);
  app.addHook("onRequest", async req => { req.user = await loadSession(db, env.SESSION_SECRET, req.cookies[COOKIE], refresh); });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Content-Security-Policy", csp);
    if (env.APP_URL.startsWith("https://")) reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  });

  // GitHub failures become clear messages instead of a generic 500.
  app.setErrorHandler((err: any, req, reply) => {
    const status = err instanceof GitHubError || err?.name === "HttpError" ? Number(err.status) : 0;
    if (status === 401) return reply.code(401).send({ error: "Your GitHub authorisation has expired. Sign out and sign in again." });
    if (status === 403 || status === 404) return reply.code(status).send({ error: "GitHub refused the request. Check that the Keel GitHub App can access this repository." });
    if (status) { req.log.warn({ err }, "GitHub request failed"); return reply.code(502).send({ error: "GitHub could not complete the request. Please try again." }); }
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
    req.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: "Something went wrong on Keel's side. Please try again." });
  });

  // Two zones: public pages, and the app (/app/*) which needs a session. The React app guards the
  // same routes on the client; doing it here too means a signed-out visitor never sees an app shell.
  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0];
    if ((path === "/app" || path.startsWith("/app/")) && !req.user)
      return reply.redirect(`/login?next=${encodeURIComponent(req.url)}`);
    if ((path === "/login" || path === "/login.html") && req.user) return reply.redirect("/app");
  });

  app.get("/healthz", async () => { await db.query("select 1"); return { ok: true }; });
  registerAuth(app, db, env);
  registerWebhooks(app, db, env);
  registerRunReports(app, db, env, opts.jwks);
  const { ensureSynced } = registerApi(app, db, env);
  registerInsights(app, db, ensureSynced);
  registerAccount(app, db);

  // The web app (web/, React) is a static build; the same build in demo mode is the GitHub Pages preview.
  const pub = opts.publicDir || [join(here, "public"), join(here, "..", "..", "web", "dist")].find(p => existsSync(join(p, "index.html")));
  // Content Security Policy: our own origin, Google Fonts, GitHub avatars, and the inline theme script by hash.
  const inline = pub ? [...readFileSync(join(pub, "index.html"), "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`) : [];
  csp = ["default-src 'self'", `script-src 'self' ${inline.join(" ")}`.trim(), "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: https://avatars.githubusercontent.com", "media-src 'self'",
    "connect-src 'self'", "frame-src https://www.youtube-nocookie.com", "frame-ancestors 'none'", "base-uri 'self'", `form-action 'self' ${env.GITHUB_WEB_URL}`].join("; ");
  if (pub) {
    await app.register(fstatic, { root: pub, index: ["index.html"], wildcard: true, cacheControl: false,
      // Built assets have content hashes in their names, so they never change; everything else revalidates.
      setHeaders: (res, file) => res.setHeader("Cache-Control", /[\\/]assets[\\/]/.test(file) ? "public, max-age=31536000, immutable" : "no-cache") });
  }
  // Client-side routes (/results, /login, /app/repos/...) all load index.html; API-like paths get JSON 404s.
  const serverOnly = /^\/(api|auth|webhooks|healthz)(\/|$)/;
  app.setNotFoundHandler((req, reply) => {
    if (pub && req.method === "GET" && !serverOnly.test(req.url) && !/\.\w+$/.test(req.url.split("?")[0]))
      return reply.type("text/html").header("Cache-Control", "no-cache").sendFile("index.html");
    return reply.code(404).send(serverOnly.test(req.url) ? { error: "not found" } : "Not found");
  });
  return app;
}
