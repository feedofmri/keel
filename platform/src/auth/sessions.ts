import type { FastifyReply, FastifyRequest } from "fastify";
import { one, type Db } from "../db/index.js";
import { decrypt, encrypt, randomId } from "../lib/crypto.js";

export const COOKIE = "keel_session";
const DAYS = 14;

export interface SessionUser { id: number; login: string; avatar_url: string | null; githubToken: string; sessionId: string }

export interface StoredToken { access_token: string; refresh_token?: string; expires_at?: number }

export async function createSession(db: Db, secret: string, userId: number, token: StoredToken): Promise<string> {
  const id = randomId();
  await db.query("insert into sessions (id, user_id, enc_github_token, token_expires_at, expires_at) values ($1, $2, $3, $4, now() + interval '14 days')",
    [id, userId, encrypt(JSON.stringify(token), secret), token.expires_at ? new Date(token.expires_at) : null]);
  return id;
}

export type Refresher = (refreshToken: string) => Promise<StoredToken | null>;

export async function loadSession(db: Db, secret: string, id: string | undefined, refresh?: Refresher): Promise<SessionUser | null> {
  if (!id) return null;
  const row = await one<{ user_id: string; login: string; avatar_url: string | null; enc_github_token: Buffer }>(db,
    `select s.user_id, u.login, u.avatar_url, s.enc_github_token from sessions s join users u on u.id = s.user_id
      where s.id = $1 and s.expires_at > now()`, [id]);
  if (!row) return null;
  let token: StoredToken;
  try { token = JSON.parse(decrypt(row.enc_github_token, secret)); } catch { return null; }
  // GitHub App user tokens expire after 8 hours; refresh them transparently (5-minute margin).
  if (token.expires_at && token.expires_at < Date.now() + 300_000) {
    const fresh = token.refresh_token && refresh ? await refresh(token.refresh_token).catch(() => null) : null;
    if (!fresh) { await destroySession(db, id); return null; }
    token = fresh;
    await db.query("update sessions set enc_github_token = $2, token_expires_at = $3 where id = $1",
      [id, encrypt(JSON.stringify(token), secret), token.expires_at ? new Date(token.expires_at) : null]);
  }
  return { id: Number(row.user_id), login: row.login, avatar_url: row.avatar_url, githubToken: token.access_token, sessionId: id };
}

export async function destroySession(db: Db, id: string): Promise<void> {
  await db.query("delete from sessions where id = $1", [id]);
}

export function setSessionCookie(reply: FastifyReply, id: string, secure: boolean) {
  reply.setCookie(COOKIE, id, { path: "/", httpOnly: true, secure, sameSite: "lax", maxAge: DAYS * 86400 });
}

declare module "fastify" {
  interface FastifyRequest { user: SessionUser | null }
}

export function requireUser(req: FastifyRequest, reply: FastifyReply): SessionUser | null {
  if (!req.user) { reply.code(401).send({ error: "sign in required" }); return null; }
  return req.user;
}
