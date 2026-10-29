import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { one, type Db } from "../db/index.js";
import type { Env } from "../env.js";

const ISSUER = "https://token.actions.githubusercontent.com";
const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

export interface ActionsClaims extends JWTPayload { repository: string; repository_id: string; run_id: string; sha?: string; event_name?: string }

/** Verify a GitHub Actions OIDC token: signed by GitHub, for our audience, not expired. */
export async function verifyActionsToken(token: string, audience: string, keys = jwks): Promise<ActionsClaims> {
  const { payload } = await jwtVerify(token, keys, { issuer: ISSUER, audience });
  if (typeof payload.repository !== "string" || typeof payload.repository_id !== "string") throw new Error("token has no repository claim");
  return payload as ActionsClaims;
}

export const ReportSchema = z.object({
  trigger: z.string().max(64),
  commit_sha: z.string().max(64),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  n_candidates: z.number().int().nonnegative().max(1000),
  selected_score: z.number().min(0).max(1).nullable(),
  threshold: z.number().nullable(),
  decision: z.enum(["AUTO-MERGE", "NEEDS REVIEW"]),
  pr_number: z.number().int().positive().nullable(),
  cost_usd: z.number().nonnegative().max(1000),
  failing_tests: z.array(z.string().max(300)).max(200).default([]),
  reasons: z.array(z.string().max(500)).max(20).default([]),
  alpha: z.number().optional(),
  method: z.string().optional(),
});

export function registerRunReports(app: FastifyInstance, db: Db, env: Env, keys = jwks) {
  app.post("/api/runs", async (req, reply) => {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return reply.code(401).send({ error: "missing token" });
    let claims: ActionsClaims;
    try { claims = await verifyActionsToken(auth.slice(7), env.OIDC_AUDIENCE, keys); }
    catch { return reply.code(401).send({ error: "invalid token" }); }
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid report", issues: parsed.error.issues.slice(0, 5) });
    const r = parsed.data;
    const repo = await one<{ id: string }>(db, "select id from repos where github_repo_id = $1", [Number(claims.repository_id)]);
    if (!repo) return reply.code(404).send({ error: "repository is not connected to Keel" });
    const run = await one<{ id: string }>(db,
      `insert into runs (repo_id, github_run_id, trigger, commit_sha, started_at, finished_at, n_candidates, selected_score,
                         threshold, decision, pr_number, cost_usd, report)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (repo_id, github_run_id) do update set finished_at = excluded.finished_at, decision = excluded.decision,
         pr_number = excluded.pr_number, report = excluded.report
       returning id`,
      [repo.id, Number(claims.run_id), r.trigger, r.commit_sha, r.started_at ?? null, r.finished_at ?? new Date().toISOString(),
       r.n_candidates, r.selected_score, r.threshold, r.decision, r.pr_number, r.cost_usd,
       JSON.stringify({ failing_tests: r.failing_tests, reasons: r.reasons, alpha: r.alpha, method: r.method })]);
    await db.query("update repos set status = 'active', activated_at = coalesce(activated_at, now()) where id = $1 and status in ('new', 'setup_pr_open')", [repo.id]);
    return reply.code(201).send({ id: Number(run!.id) });
  });
}
