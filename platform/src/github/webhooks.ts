import type { FastifyInstance } from "fastify";
import { verify } from "@octokit/webhooks-methods";
import { one, type Db } from "../db/index.js";
import type { Env } from "../env.js";

/** GitHub App webhooks. The raw body is needed to check the HMAC signature. */
export function registerWebhooks(app: FastifyInstance, db: Db, env: Env) {
  app.post("/webhooks/github", { config: { rawBody: true } }, async (req, reply) => {
    const sig = String(req.headers["x-hub-signature-256"] || "");
    const raw = (req as any).rawBody as string | undefined;
    if (!env.GITHUB_WEBHOOK_SECRET || !raw || !(await verify(env.GITHUB_WEBHOOK_SECRET, raw, sig).catch(() => false)))
      return reply.code(401).send({ error: "bad signature" });
    const event = String(req.headers["x-github-event"] || "");
    await handleEvent(db, event, JSON.parse(raw));
    return reply.send({ ok: true });
  });
}

export async function handleEvent(db: Db, event: string, p: any): Promise<void> {
  if (event === "installation" || event === "installation_repositories") {
    const inst = p.installation;
    if (p.action === "deleted") { await db.query("delete from installations where github_installation_id = $1", [inst.id]); return; }
    const row = await one<{ id: string }>(db,
      `insert into installations (github_installation_id, account_login, account_type, suspended) values ($1,$2,$3,$4)
       on conflict (github_installation_id) do update set account_login = excluded.account_login, suspended = excluded.suspended
       returning id`, [inst.id, inst.account.login, inst.account.type, p.action === "suspend"]);
    for (const r of p.repositories_removed || []) await db.query("delete from repos where github_repo_id = $1", [r.id]);
    for (const r of [...(p.repositories || []), ...(p.repositories_added || [])])
      await db.query(`insert into repos (installation_id, github_repo_id, full_name) values ($1,$2,$3)
                      on conflict (github_repo_id) do update set full_name = excluded.full_name, installation_id = excluded.installation_id`,
                     [row!.id, r.id, r.full_name]);
    return;
  }
  if (event === "pull_request" && p.action === "closed") {
    const repo = await one<{ id: string; setup_pr_number: number | null }>(db,
      "select id, setup_pr_number from repos where github_repo_id = $1", [p.repository.id]);
    if (!repo) return;
    const pr = p.pull_request;
    if (repo.setup_pr_number === pr.number) {
      // Merged: Keel is live. Closed without merging: back to "not set up" (an active repo stays active).
      if (pr.merged) await db.query("update repos set status = 'active', activated_at = coalesce(activated_at, now()) where id = $1", [repo.id]);
      else await db.query("update repos set status = 'new', setup_pr_number = null where id = $1 and status = 'setup_pr_open'", [repo.id]);
      return;
    }
    if (pr.merged && (pr.head?.ref || "").startsWith("keel/fix-")) {
      await db.query(`insert into outcomes (run_id, merged_at) select id, now() from runs where repo_id = $1 and pr_number = $2
                      on conflict (run_id) do update set merged_at = excluded.merged_at`, [repo.id, pr.number]);
      return;
    }
    // A merged revert of a Keel fix is the strongest signal that an auto-merge was wrong.
    const m = /^Revert "\[(AUTO-MERGE|NEEDS REVIEW)\]/.exec(pr.title || "");
    const num = /#(\d+)/.exec(pr.body || "");
    if (pr.merged && m && num) {
      await db.query(`insert into outcomes (run_id, reverted_at, labelled_wrong) select id, now(), true from runs where repo_id = $1 and pr_number = $2
                      on conflict (run_id) do update set reverted_at = now(), labelled_wrong = true`, [repo.id, Number(num[1])]);
    }
    return;
  }
  if (event === "pull_request" && p.action === "labeled" && p.label?.name === "keel:wrong") {
    await db.query(`insert into outcomes (run_id, labelled_wrong) select r.id, true from runs r join repos rp on rp.id = r.repo_id
                    where rp.github_repo_id = $1 and r.pr_number = $2 on conflict (run_id) do update set labelled_wrong = true`,
                   [p.repository.id, p.pull_request.number]);
  }
}
