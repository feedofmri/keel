import type { FastifyInstance } from "fastify";
import { one, type Db } from "../db/index.js";
import type { Env } from "../env.js";
import { randomId } from "../lib/crypto.js";
import { userApi } from "../github/client.js";
import { COOKIE, createSession, destroySession, setSessionCookie, type StoredToken } from "./sessions.js";

const STATE_COOKIE = "keel_oauth_state";

export function registerAuth(app: FastifyInstance, db: Db, env: Env) {
  const secure = env.APP_URL.startsWith("https://");
  const redirectUri = `${env.APP_URL}/auth/github/callback`;

  app.get("/auth/github/login", async (_req, reply) => {
    const state = randomId(16);
    reply.setCookie(STATE_COOKIE, state, { path: "/auth", httpOnly: true, secure, sameSite: "lax", maxAge: 600 });
    const u = new URL("https://github.com/login/oauth/authorize");
    u.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return reply.redirect(u.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string; installation_id?: string } }>("/auth/github/callback", async (req, reply) => {
    const { code, state } = req.query;
    const expected = req.cookies[STATE_COOKIE];
    reply.clearCookie(STATE_COOKIE, { path: "/auth" });
    // Installing the App can also land here; it then needs a normal sign-in round trip.
    if (!code) return reply.redirect("/app");
    if (!state || !expected || state !== expected) return reply.code(400).send("Invalid sign-in state. Please try again.");

    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const tok = await r.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!tok.access_token) return reply.code(400).send(`GitHub sign-in failed: ${tok.error || "no token"}`);

    const gh = await userApi<{ id: number; login: string; avatar_url: string }>(tok.access_token, "/user");
    const user = await one<{ id: string }>(db,
      `insert into users (github_id, login, avatar_url) values ($1, $2, $3)
       on conflict (github_id) do update set login = excluded.login, avatar_url = excluded.avatar_url returning id`,
      [gh.id, gh.login, gh.avatar_url]);
    const stored: StoredToken = { access_token: tok.access_token, refresh_token: tok.refresh_token,
                                  expires_at: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined };
    const sid = await createSession(db, env.SESSION_SECRET, Number(user!.id), stored);
    setSessionCookie(reply, sid, secure);
    return reply.redirect("/app");
  });

  app.post("/auth/logout", async (req, reply) => {
    const sid = req.cookies[COOKIE];
    if (sid) await destroySession(db, sid);
    reply.clearCookie(COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });
}
