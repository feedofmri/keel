import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import fstatic from "@fastify/static";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerApi } from "./api.js";
import { registerAuth } from "./auth/github.js";
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
  app.addHook("onRequest", async req => { req.user = await loadSession(db, env.SESSION_SECRET, req.cookies[COOKIE]); });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
  });

  app.get("/healthz", async () => { await db.query("select 1"); return { ok: true }; });
  registerAuth(app, db, env);
  registerWebhooks(app, db, env);
  registerRunReports(app, db, env, opts.jwks);
  registerApi(app, db, env);

  // The marketing site and the app UI are static files (the same files GitHub Pages serves).
  const pub = opts.publicDir || [join(here, "public"), join(here, "..", "..", "site")].find(existsSync);
  if (pub) {
    await app.register(fstatic, { root: pub, index: ["index.html"], redirect: true });
    app.get("/app", (_req, reply) => reply.redirect("/app/"));
  }
  app.setNotFoundHandler((req, reply) => reply.code(404).send(req.url.startsWith("/api/") ? { error: "not found" } : "Not found"));
  return app;
}
