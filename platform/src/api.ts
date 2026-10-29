import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { many, one, type Db } from "./db/index.js";
import { githubConfigured, type Env } from "./env.js";
import { requireUser, type SessionUser } from "./auth/sessions.js";
import { canManage, installationOctokit, userApi, userPermission, type RepoPermission } from "./github/client.js";
import { detect } from "./setup/detect.js";
import { renderKeelToml, renderWorkflow, secretNamesFor, type RepoSettings } from "./setup/files.js";
import { openSetupPR, setupPRBody } from "./setup/pr.js";
import { putRepoSecrets } from "./setup/secrets.js";

interface RepoRow { id: string; full_name: string; status: string; alpha: string; method: string; auto_merge: boolean; models: string[];
  test_command: string | null; ci_workflow: string | null; setup_pr_number: number | null; default_branch: string;
  github_installation_id: string; activated_at: string | null }

const MODELS = ["muse-spark", "muse-spark-open", "muse-glimmer"] as const;
const SetupBody = z.object({
  alpha: z.number().min(0.01).max(0.5),
  method: z.enum(["crc", "ltt"]),
  autoMerge: z.boolean(),
  models: z.array(z.enum(MODELS)).min(1),
  ciWorkflow: z.string().max(200).nullable(),
  installCommand: z.string().max(300).regex(/^[^`$;&|<>]*$/, "install command may not contain shell metacharacters"),
  secrets: z.record(z.string().regex(/^KEEL_[A-Z_]+$/), z.string().max(4000)).default({}),
});

export function registerApi(app: FastifyInstance, db: Db, env: Env): { ensureSynced: (u: SessionUser) => Promise<void> } {
  // CSRF: state-changing browser calls must come from our origin and carry a custom header.
  app.addHook("preHandler", async (req, reply) => {
    // Exempt: GETs, and the Action's run report (POST /api/runs), which authenticates with an OIDC token instead.
    if (req.method === "GET" || !req.url.startsWith("/api/") || req.url.split("?")[0] === "/api/runs") return;
    const origin = req.headers.origin;
    if (req.headers["x-keel"] !== "1" || (origin && origin !== env.APP_URL)) return reply.code(403).send({ error: "forbidden" });
  });

  app.get("/api/me", async req => ({
    user: req.user ? { login: req.user.login, avatar_url: req.user.avatar_url } : null,
    configured: githubConfigured(env),
    installUrl: `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
  }));

  // Refresh which installed repositories this user can see, and remember it for the cross-repo pages.
  async function syncRepos(user: SessionUser) {
    const { installations } = await userApi<{ installations: any[] }>(user.githubToken, "/user/installations?per_page=100");
    const out: any[] = [], seen: string[] = [];
    for (const inst of installations) {
      const row = await one<{ id: string }>(db,
        `insert into installations (github_installation_id, account_login, account_type) values ($1,$2,$3)
         on conflict (github_installation_id) do update set account_login = excluded.account_login returning id`,
        [inst.id, inst.account.login, inst.account.type]);
      const { repositories } = await userApi<{ repositories: any[] }>(user.githubToken, `/user/installations/${inst.id}/repositories?per_page=100`);
      for (const r of repositories) {
        const rr = await one<{ id: string; status: string; alpha: string }>(db,
          `insert into repos (installation_id, github_repo_id, full_name, default_branch) values ($1,$2,$3,$4)
           on conflict (github_repo_id) do update set full_name = excluded.full_name, default_branch = excluded.default_branch,
             installation_id = excluded.installation_id
           returning id, status, alpha`, [row!.id, r.id, r.full_name, r.default_branch || "main"]);
        const p = r.permissions || {}, manage = Boolean(p.admin || p.maintain);
        await db.query(`insert into user_repos (user_id, repo_id, can_manage) values ($1,$2,$3)
                        on conflict (user_id, repo_id) do update set can_manage = excluded.can_manage`, [user.id, rr!.id, manage]);
        seen.push(rr!.id);
        out.push({ full_name: r.full_name, private: r.private, language: r.language, status: rr!.status, alpha: Number(rr!.alpha),
                   canManage: manage, installation: inst.account.login });
      }
    }
    await db.query("delete from user_repos where user_id = $1 and not (repo_id = any($2::bigint[]))", [user.id, seen]);
    await db.query("update users set repos_synced_at = now() where id = $1", [user.id]);
    return { repos: out, installations: installations.map(i => ({ id: i.id, account: i.account.login, type: i.account.type,
      repositorySelection: i.repository_selection, manageUrl: i.html_url })) };
  }
  const ensureSynced = async (user: SessionUser) => {
    const u = await one<{ fresh: boolean }>(db, "select coalesce(repos_synced_at > now() - interval '10 minutes', false) as fresh from users where id = $1", [user.id]);
    if (!u?.fresh) await syncRepos(user);
  };

  app.get("/api/repos", async (req, reply) => {
    const user = requireUser(req, reply); if (!user) return;
    return syncRepos(user);
  });

  async function repoFor(req: FastifyRequest<{ Params: { owner: string; name: string } }>, reply: FastifyReply, need: "read" | "manage") {
    const user = requireUser(req, reply); if (!user) return null;
    const full = `${req.params.owner}/${req.params.name}`;
    if (!/^[\w.-]+\/[\w.-]+$/.test(full)) { reply.code(400).send({ error: "bad repository name" }); return null; }
    const perm: RepoPermission = await userPermission(user.githubToken, full);
    if (perm === "none" || (need === "manage" && !canManage(perm))) { reply.code(403).send({ error: "you need admin or maintain access to this repository" }); return null; }
    const repo = await one<RepoRow>(db, `select r.*, i.github_installation_id from repos r join installations i on i.id = r.installation_id
                                          where lower(r.full_name) = lower($1)`, [full]);
    if (!repo) { reply.code(404).send({ error: "Keel is not installed on this repository" }); return null; }
    return { user, repo, perm };
  }
  const octoFor = (repo: RepoRow) => installationOctokit(env, Number(repo.github_installation_id));

  app.get<{ Params: { owner: string; name: string } }>("/api/repos/:owner/:name", async (req, reply) => {
    const ctx = await repoFor(req, reply, "read"); if (!ctx) return;
    const runs = await many(db, `select r.id, r.trigger, r.commit_sha, r.finished_at, r.n_candidates, r.selected_score, r.threshold,
                                        r.decision, r.pr_number, r.cost_usd, r.report, o.merged_at, o.reverted_at, o.labelled_wrong
                                   from runs r left join outcomes o on o.run_id = r.id where r.repo_id = $1
                                  order by r.created_at desc limit 50`, [ctx.repo.id]);
    const merged = runs.filter((r: any) => r.decision === "AUTO-MERGE").length;
    const wrong = runs.filter((r: any) => r.decision === "AUTO-MERGE" && (r.labelled_wrong || r.reverted_at)).length;
    return { repo: { full_name: ctx.repo.full_name, status: ctx.repo.status, alpha: Number(ctx.repo.alpha), method: ctx.repo.method,
                     autoMerge: ctx.repo.auto_merge, models: ctx.repo.models, ciWorkflow: ctx.repo.ci_workflow,
                     setupPr: ctx.repo.setup_pr_number, activatedAt: ctx.repo.activated_at, canManage: canManage(ctx.perm) },
             stats: { runs: runs.length, autoMerged: merged, wrong, cost: runs.reduce((s: number, r: any) => s + Number(r.cost_usd || 0), 0) },
             runs };
  });

  app.get<{ Params: { owner: string; name: string } }>("/api/repos/:owner/:name/detect", async (req, reply) => {
    const ctx = await repoFor(req, reply, "manage"); if (!ctx) return;
    const octo = await octoFor(ctx.repo);
    const [owner, repo] = ctx.repo.full_name.split("/");
    const { data: tree } = await octo.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", { owner, repo, tree_sha: ctx.repo.default_branch, recursive: "1" });
    const paths: string[] = tree.tree.filter((t: any) => t.type === "blob").map((t: any) => t.path);
    const files: Record<string, string> = {};
    for (const p of paths.filter(p => p.startsWith(".github/workflows/")).slice(0, 20)) {
      const { data } = await octo.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo, path: p });
      if (!Array.isArray(data) && "content" in data && data.content) files[p] = Buffer.from(data.content, "base64").toString("utf8");
    }
    return { detection: detect(paths, files), secretNames: secretNamesFor([...MODELS]) };
  });

  app.post<{ Params: { owner: string; name: string } }>("/api/repos/:owner/:name/setup", async (req, reply) => {
    const ctx = await repoFor(req, reply, "manage"); if (!ctx) return;
    const body = SetupBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid settings", issues: body.error.issues.slice(0, 5) });
    const b = body.data;
    const allowed = new Set(secretNamesFor(b.models));
    const secrets = Object.fromEntries(Object.entries(b.secrets).filter(([k]) => allowed.has(k)));
    const settings: RepoSettings = { alpha: b.alpha, method: b.method, autoMerge: b.autoMerge, models: b.models, ciWorkflow: b.ciWorkflow,
                                     installCommand: b.installCommand, testCommand: "{python} -m pytest -q -p no:cacheprovider {tests} --junitxml={junit}" };
    const octo = await octoFor(ctx.repo);
    const [owner, repo] = ctx.repo.full_name.split("/");
    const stored = await putRepoSecrets(octo, owner, repo, secrets);
    const pr = await openSetupPR(octo, owner, repo, ctx.repo.default_branch, {
      ".github/workflows/keel.yml": renderWorkflow(settings, env.KEEL_ACTION_REF, env.APP_URL),
      ".keel.toml": renderKeelToml(settings),
    }, setupPRBody(env.APP_URL, b.alpha, b.method, b.autoMerge));
    await db.query(`update repos set status = case when status = 'active' then 'active' else 'setup_pr_open' end, alpha = $2, method = $3,
                    auto_merge = $4, models = $5, ci_workflow = $6, setup_pr_number = $7, created_by = coalesce(created_by, $8) where id = $1`,
                   [ctx.repo.id, b.alpha, b.method, b.autoMerge, b.models, b.ciWorkflow, pr.number, ctx.user.id]);
    await db.query("insert into audit_log (user_id, repo_id, action, detail) values ($1,$2,'setup_pr',$3)",
                   [ctx.user.id, ctx.repo.id, JSON.stringify({ pr: pr.number, secrets: stored })]);
    return { pr, secretsStored: stored };
  });

  app.post<{ Params: { owner: string; name: string } }>("/api/repos/:owner/:name/fix", async (req, reply) => {
    const ctx = await repoFor(req, reply, "manage"); if (!ctx) return;
    const octo = await octoFor(ctx.repo);
    const [owner, repo] = ctx.repo.full_name.split("/");
    await octo.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", { owner, repo, workflow_id: "keel.yml", ref: ctx.repo.default_branch });
    await db.query("insert into audit_log (user_id, repo_id, action) values ($1,$2,'fix_now')", [ctx.user.id, ctx.repo.id]);
    return { ok: true };
  });

  for (const action of ["pause", "resume"] as const) {
    app.post<{ Params: { owner: string; name: string } }>(`/api/repos/:owner/:name/${action}`, async (req, reply) => {
      const ctx = await repoFor(req, reply, "manage"); if (!ctx) return;
      const octo = await octoFor(ctx.repo);
      const [owner, repo] = ctx.repo.full_name.split("/");
      await octo.request(`PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/${action === "pause" ? "disable" : "enable"}`,
                         { owner, repo, workflow_id: "keel.yml" });
      await db.query("update repos set status = $2 where id = $1", [ctx.repo.id, action === "pause" ? "paused" : "active"]);
      await db.query("insert into audit_log (user_id, repo_id, action) values ($1,$2,$3)", [ctx.user.id, ctx.repo.id, action]);
      return { ok: true };
    });
  }

  // Stop tracking a repository: its runs and activity are deleted here. The workflow file stays in the
  // repository until someone removes it, and the GitHub App stays installed until it is uninstalled on GitHub.
  app.post<{ Params: { owner: string; name: string } }>("/api/repos/:owner/:name/disconnect", async (req, reply) => {
    const ctx = await repoFor(req, reply, "manage"); if (!ctx) return;
    await db.query("delete from repos where id = $1", [ctx.repo.id]);
    await db.query("insert into audit_log (user_id, repo_id, action, detail) values ($1, null, 'disconnect', $2)",
                   [ctx.user.id, JSON.stringify({ repo: ctx.repo.full_name })]);
    return { ok: true };
  });

  return { ensureSynced };
}
