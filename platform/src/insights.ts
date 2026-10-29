import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { many, one, type Db } from "./db/index.js";
import { requireUser, type SessionUser } from "./auth/sessions.js";

// Cross-repository pages: overview, runs, run detail, usage, calibration health and activity.
// Everything is scoped to the repositories the signed-in user can see on GitHub (user_repos).
const VISIBLE = "select repo_id from user_repos where user_id = $1";

const RUN_COLUMNS = `r.id, rp.full_name as repo, r.trigger, r.commit_sha, r.started_at, r.finished_at, r.n_candidates, r.selected_score,
  r.threshold, r.decision, r.pr_number, r.cost_usd, r.report->'failing_tests' as failing_tests,
  o.merged_at, o.reverted_at, o.labelled_wrong`;
const RUN_FROM = "from runs r join repos rp on rp.id = r.repo_id left join outcomes o on o.run_id = r.id";

const RunsQuery = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
  decision: z.enum(["auto", "review"]).optional(),
  outcome: z.enum(["wrong", "merged", "open"]).optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function registerInsights(app: FastifyInstance, db: Db, ensureSynced: (u: SessionUser) => Promise<void>) {
  const user = async (req: any, reply: any) => {
    const u = requireUser(req, reply); if (!u) return null;
    await ensureSynced(u); return u;
  };

  app.get("/api/overview", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const totals = await one<any>(db, `
      select (select count(*) from repos where id in (${VISIBLE}))::int as repos,
             (select count(*) from repos where id in (${VISIBLE}) and status = 'active')::int as active,
             (select count(*) from repos where id in (${VISIBLE}) and status in ('new', 'setup_pr_open'))::int as pending,
             count(r.id)::int as runs,
             count(*) filter (where r.decision = 'AUTO-MERGE')::int as auto_merged,
             count(*) filter (where r.decision = 'NEEDS REVIEW')::int as review,
             count(*) filter (where r.decision = 'AUTO-MERGE' and (o.labelled_wrong or o.reverted_at is not null))::int as wrong,
             coalesce(sum(r.cost_usd), 0)::float as cost
        from runs r left join outcomes o on o.run_id = r.id
       where r.repo_id in (${VISIBLE}) and r.created_at > now() - interval '30 days'`, [u.id]);
    const recent = await many(db, `select ${RUN_COLUMNS} ${RUN_FROM} where r.repo_id in (${VISIBLE}) order by r.created_at desc limit 8`, [u.id]);
    const queue = await many(db, `select ${RUN_COLUMNS} ${RUN_FROM} where r.repo_id in (${VISIBLE}) and r.decision = 'NEEDS REVIEW'
                                  and o.merged_at is null and r.pr_number is not null order by r.created_at desc limit 5`, [u.id]);
    const setup = await many(db, `select rp.full_name, rp.status, ur.can_manage from repos rp join user_repos ur on ur.repo_id = rp.id and ur.user_id = $1
                                  where rp.status in ('new', 'setup_pr_open', 'error') order by rp.full_name limit 10`, [u.id]);
    return { totals, recent, queue, setup };
  });

  app.get("/api/runs", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const q = RunsQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid filter" });
    const f = q.data, where = [`r.repo_id in (${VISIBLE})`], params: unknown[] = [u.id];
    const add = (sql: string, v?: unknown) => { if (v !== undefined) params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
    if (f.repo) add("lower(rp.full_name) = lower(?)", f.repo);
    if (f.decision) add("r.decision = ?", f.decision === "auto" ? "AUTO-MERGE" : "NEEDS REVIEW");
    if (f.outcome === "wrong") where.push("(o.labelled_wrong or o.reverted_at is not null)");
    if (f.outcome === "merged") where.push("o.merged_at is not null");
    if (f.outcome === "open") where.push("o.merged_at is null and r.pr_number is not null");
    if (f.before) add("r.id < ?", f.before);
    params.push(f.limit);
    const runs = await many(db, `select ${RUN_COLUMNS} ${RUN_FROM} where ${where.join(" and ")} order by r.id desc limit $${params.length}`, params);
    return { runs, next: runs.length === f.limit ? Number((runs[runs.length - 1] as any).id) : null };
  });

  const runFor = async (u: SessionUser, id: string) =>
    one<any>(db, `select ${RUN_COLUMNS}, r.report, ur.can_manage ${RUN_FROM} join user_repos ur on ur.repo_id = r.repo_id and ur.user_id = $1
                  where r.id = $2`, [u.id, id]);

  app.get<{ Params: { id: string } }>("/api/runs/:id", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    if (!/^\d+$/.test(req.params.id)) return reply.code(400).send({ error: "bad run id" });
    const run = await runFor(u, req.params.id);
    if (!run) return reply.code(404).send({ error: "run not found" });
    return { run };
  });

  // A maintainer can mark an auto-merged fix as wrong (or undo it). This feeds the risk budget and recalibration.
  app.post<{ Params: { id: string } }>("/api/runs/:id/feedback", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const body = z.object({ wrong: z.boolean() }).safeParse(req.body);
    if (!/^\d+$/.test(req.params.id) || !body.success) return reply.code(400).send({ error: "invalid feedback" });
    const run = await runFor(u, req.params.id);
    if (!run) return reply.code(404).send({ error: "run not found" });
    if (!run.can_manage) return reply.code(403).send({ error: "you need admin or maintain access to this repository" });
    await db.query(`insert into outcomes (run_id, labelled_wrong) values ($1, $2)
                    on conflict (run_id) do update set labelled_wrong = excluded.labelled_wrong`, [req.params.id, body.data.wrong]);
    await db.query("insert into audit_log (user_id, repo_id, action, detail) select $1, repo_id, $2, $3 from runs where id = $4",
                   [u.id, body.data.wrong ? "marked_wrong" : "unmarked_wrong", JSON.stringify({ run: Number(req.params.id) }), req.params.id]);
    return { ok: true };
  });

  app.get<{ Querystring: { days?: string } }>("/api/usage", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const daily = await many(db, `
      select to_char(d, 'YYYY-MM-DD') as day, count(r.id)::int as runs, coalesce(sum(r.cost_usd), 0)::float as cost,
             count(*) filter (where r.decision = 'AUTO-MERGE')::int as auto_merged
        from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d
        left join runs r on r.created_at >= d and r.created_at < d + interval '1 day' and r.repo_id in (${VISIBLE})
       group by d order by d`, [u.id, days]);
    const byRepo = await many(db, `
      select rp.full_name as repo, count(r.id)::int as runs, coalesce(sum(r.cost_usd), 0)::float as cost,
             count(*) filter (where r.decision = 'AUTO-MERGE')::int as auto_merged
        from runs r join repos rp on rp.id = r.repo_id
       where r.repo_id in (${VISIBLE}) and r.created_at > now() - make_interval(days => $2::int)
       group by rp.full_name order by cost desc`, [u.id, days]);
    const byModel = await many(db, `
      select c->>'model' as model, count(*)::int as candidates, coalesce(sum((c->>'cost_usd')::numeric), 0)::float as cost,
             count(*) filter (where (c->>'selected')::boolean)::int as selected
        from runs r, jsonb_array_elements(coalesce(r.report->'candidates', '[]'::jsonb)) c
       where r.repo_id in (${VISIBLE}) and r.created_at > now() - make_interval(days => $2::int)
       group by 1 order by cost desc`, [u.id, days]);
    return { days, daily, byRepo, byModel };
  });

  // Is the guarantee holding? Observed wrong auto-merges per repository against its α.
  app.get("/api/calibration", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const repos = await many(db, `
      select rp.full_name as repo, rp.status, rp.alpha::float as alpha, rp.method, rp.calibration_ref,
             count(r.id)::int as runs,
             count(*) filter (where r.decision = 'AUTO-MERGE')::int as auto_merged,
             count(*) filter (where r.decision = 'AUTO-MERGE' and (o.labelled_wrong or o.reverted_at is not null))::int as wrong,
             (array_agg(r.report->>'n_calibration' order by r.created_at desc) filter (where r.report ? 'n_calibration'))[1] as n_calibration,
             (array_agg(r.report->>'guarantee' order by r.created_at desc) filter (where r.report ? 'guarantee'))[1] as guarantee
        from repos rp left join runs r on r.repo_id = rp.id left join outcomes o on o.run_id = r.id
       where rp.id in (${VISIBLE}) and rp.status <> 'new'
       group by rp.id order by rp.full_name`, [u.id]);
    return { repos };
  });

  app.get<{ Querystring: { repo?: string; before?: string } }>("/api/activity", async (req, reply) => {
    const u = await user(req, reply); if (!u) return;
    const params: unknown[] = [u.id];
    let where = `(a.repo_id in (${VISIBLE}) or (a.repo_id is null and a.user_id = $1))`;
    if (req.query.repo) { params.push(req.query.repo); where += ` and lower(rp.full_name) = lower($${params.length})`; }
    if (req.query.before && /^\d+$/.test(req.query.before)) { params.push(req.query.before); where += ` and a.id < $${params.length}`; }
    const events = await many(db, `select a.id, a.action, a.detail, a.at, us.login as actor, us.avatar_url, rp.full_name as repo
                                     from audit_log a left join users us on us.id = a.user_id left join repos rp on rp.id = a.repo_id
                                    where ${where} order by a.id desc limit 50`, params);
    return { events, next: events.length === 50 ? Number((events[49] as any).id) : null };
  });
}
