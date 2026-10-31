import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import { many, one, type Db } from "./db/index.js";
import { COOKIE, requireUser } from "./auth/sessions.js";
import type { Env } from "./env.js";
import { hintFor, isKeyName, savedKeys, saveKeys } from "./setup/keys.js";

const MODELS = ["muse-spark", "muse-spark-open", "muse-glimmer"] as const;
const Defaults = z.object({
  alpha: z.number().min(0.01).max(0.5),
  method: z.enum(["crc", "ltt"]),
  autoMerge: z.boolean(),
  models: z.array(z.enum(MODELS)).min(1),
});

const KeysBody = z.object({ keys: z.record(z.string().refine(isKeyName, "unknown key name"), z.string().max(4000)) });

// Account pages: defaults for new repositories, saved model keys, signed-in sessions, and deleting your Keel data.
export function registerAccount(app: FastifyInstance, db: Db, env: Env) {
  app.get("/api/settings", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const s = await one<any>(db, "select default_alpha::float as alpha, default_method as method, default_auto_merge as \"autoMerge\", default_models as models from user_settings where user_id = $1", [u.id]);
    return { defaults: s || { alpha: 0.1, method: "crc", autoMerge: false, models: ["muse-spark", "muse-spark-open"] } };
  });

  app.put("/api/settings", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const b = Defaults.safeParse((req.body as any)?.defaults);
    if (!b.success) return reply.code(400).send({ error: "invalid settings" });
    const d = b.data;
    await db.query(`insert into user_settings (user_id, default_alpha, default_method, default_auto_merge, default_models) values ($1,$2,$3,$4,$5)
                    on conflict (user_id) do update set default_alpha = excluded.default_alpha, default_method = excluded.default_method,
                      default_auto_merge = excluded.default_auto_merge, default_models = excluded.default_models, updated_at = now()`,
                   [u.id, d.alpha, d.method, d.autoMerge, d.models]);
    return { defaults: d };
  });

  // Saved values never come back to the browser: API keys show only their last 4 characters.
  app.get("/api/settings/keys", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const saved = await savedKeys(db, env.SESSION_SECRET, u.id);
    const at = await many<{ name: string; updated_at: string }>(db, "select name, updated_at from user_model_keys where user_id = $1", [u.id]);
    return { keys: at.filter(r => r.name in saved).map(r => ({ name: r.name, hint: hintFor(r.name, saved[r.name]), updatedAt: r.updated_at })) };
  });

  app.put("/api/settings/keys", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const b = KeysBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "invalid keys" });
    await saveKeys(db, env.SESSION_SECRET, u.id, b.data.keys);
    await db.query("insert into audit_log (user_id, repo_id, action, detail) values ($1, null, 'keys_saved', $2)",
                   [u.id, JSON.stringify({ names: Object.keys(b.data.keys) })]);
    return { ok: true };
  });

  // Session ids are secrets, so the client only ever sees a short hash of each.
  const tag = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 10);
  app.get("/api/account", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const user = await one<any>(db, "select login, avatar_url, created_at from users where id = $1", [u.id]);
    const sessions = await many<any>(db, "select id, created_at, expires_at from sessions where user_id = $1 and expires_at > now() order by created_at desc", [u.id]);
    return { user, sessions: sessions.map(s => ({ id: tag(s.id), created_at: s.created_at, expires_at: s.expires_at, current: s.id === u.sessionId })) };
  });

  app.post("/api/account/sessions/revoke-others", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const r = await db.query("delete from sessions where user_id = $1 and id <> $2", [u.id, u.sessionId]);
    return { revoked: r.rowCount };
  });

  // Deletes the Keel account (sessions, settings, repo access). Runs stay with their repository for its
  // other maintainers; audit entries keep the event but lose the user.
  app.delete("/api/account", async (req, reply) => {
    const u = requireUser(req, reply); if (!u) return;
    const b = z.object({ confirm: z.string() }).safeParse(req.body);
    if (!b.success || b.data.confirm !== u.login) return reply.code(400).send({ error: "type your GitHub username to confirm" });
    await db.query("delete from users where id = $1", [u.id]);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });
}
