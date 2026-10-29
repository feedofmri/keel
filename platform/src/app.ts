import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fstatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerApi } from "./api.js";
import { githubRefresher, registerAuth } from "./auth/github.js";
import { COOKIE, loadSession } from "./auth/sessions.js";
import type { Db } from "./db/index.js";
import type { Env } from "./env.js";
import { registerWebhooks } from "./github/webhooks.js";
import { registerRunReports } from "./runs/report.js";

const here = dirname(fileURLToPath(import.meta.url));

export async function buildApp(db: Db, env: Env, opts: { jwks?: any; publicDir?: string } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== "test", trustProxy: true, bodyLimit: 512 * 1024 });
  await app.register(cookie);
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
  registerApi(app, db, env);

  // The web app (web/, React) is a static build; the same build in demo mode is the GitHub Pages preview.
  const pub = opts.publicDir || [join(here, "public"), join(here, "..", "..", "web", "dist")].find(p => existsSync(join(p, "index.html")));
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
