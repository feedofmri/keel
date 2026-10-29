import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession } from "../src/auth/sessions.js";
import { createDb, one, type Db } from "../src/db/index.js";
import { prune } from "../src/db/retention.js";
import { loadEnv } from "../src/env.js";
import { migrate } from "../src/migrate.js";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("platform app (needs TEST_DATABASE_URL)", () => {
  let db: Db; let app: Awaited<ReturnType<typeof buildApp>>; let signer: any;
  const env = loadEnv({ DATABASE_URL: url!, SESSION_SECRET: "s".repeat(40), NODE_ENV: "test", GITHUB_WEBHOOK_SECRET: "whsec",
                        APP_URL: "https://keel.boraqs.com", OIDC_AUDIENCE: "keel.boraqs.com" } as any);

  beforeAll(async () => {
    db = createDb(url!);
    await db.query("drop schema public cascade; create schema public");
    await migrate(db, () => {});
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    signer = privateKey;
    const pub = mkdtempSync(join(tmpdir(), "keel-web-"));
    mkdirSync(join(pub, "assets")); writeFileSync(join(pub, "index.html"), "<div id=root></div>"); writeFileSync(join(pub, "assets", "a.js"), "1");
    app = await buildApp(db, env, { jwks: createLocalJWKSet({ keys: [jwk] }), publicDir: pub });
  });
  afterAll(async () => { await app.close(); await db.end(); });

  const sign = (body: string) => "sha256=" + createHmac("sha256", "whsec").update(body).digest("hex");
  const hook = (event: string, payload: unknown, sig?: string) => {
    const body = JSON.stringify(payload);
    return app.inject({ method: "POST", url: "/webhooks/github", payload: body,
      headers: { "content-type": "application/json", "x-github-event": event, "x-hub-signature-256": sig ?? sign(body) } });
  };
  const oidc = (claims: Record<string, unknown>, aud = "keel.boraqs.com") => new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer("https://token.actions.githubusercontent.com")
    .setAudience(aud).setIssuedAt().setExpirationTime("5m").sign(signer);

  it("health check", async () => expect((await app.inject("/healthz")).json()).toEqual({ ok: true }));

  it("rejects webhooks with a bad signature", async () => {
    expect((await hook("installation", { action: "created" }, "sha256=00")).statusCode).toBe(401);
  });

  it("records installations and repositories from webhooks", async () => {
    const r = await hook("installation", { action: "created", installation: { id: 77, account: { login: "acme", type: "Organization" } },
                                          repositories: [{ id: 501, full_name: "acme/shop" }] });
    expect(r.statusCode).toBe(200);
    expect(await one(db, "select full_name, status from repos where github_repo_id = 501")).toEqual({ full_name: "acme/shop", status: "new" });
  });

  it("activates a repo when its setup PR is merged", async () => {
    await db.query("update repos set setup_pr_number = 3, status = 'setup_pr_open' where github_repo_id = 501");
    await hook("pull_request", { action: "closed", repository: { id: 501 }, pull_request: { number: 3, merged: true, head: { ref: "keel/setup" } } });
    expect((await one<{ status: string }>(db, "select status from repos where github_repo_id = 501"))!.status).toBe("active");
  });

  const report = { trigger: "workflow_run", commit_sha: "abc123", n_candidates: 10, selected_score: 0.01, threshold: 0.375,
                   decision: "AUTO-MERGE", pr_number: 12, cost_usd: 0.05, failing_tests: ["tests/test_x.py::test_a"], reasons: ["ok"] };

  it("accepts run reports authenticated by a GitHub Actions OIDC token", async () => {
    const tok = await oidc({ repository: "acme/shop", repository_id: "501", run_id: "9001" });
    const r = await app.inject({ method: "POST", url: "/api/runs", payload: report, headers: { authorization: `Bearer ${tok}` } });
    expect(r.statusCode).toBe(201);
    expect((await one<{ decision: string }>(db, "select decision from runs where github_run_id = 9001"))!.decision).toBe("AUTO-MERGE");
  });

  it("rejects reports with the wrong audience, an unknown repo, or no token", async () => {
    const wrongAud = await oidc({ repository: "acme/shop", repository_id: "501", run_id: "1" }, "someone-else");
    expect((await app.inject({ method: "POST", url: "/api/runs", payload: report, headers: { authorization: `Bearer ${wrongAud}` } })).statusCode).toBe(401);
    const unknown = await oidc({ repository: "x/y", repository_id: "999", run_id: "1" });
    expect((await app.inject({ method: "POST", url: "/api/runs", payload: report, headers: { authorization: `Bearer ${unknown}` } })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/runs", payload: report })).statusCode).toBe(401);
  });

  it("marks a reverted auto-merge as wrong", async () => {
    await hook("pull_request", { action: "closed", repository: { id: 501 },
      pull_request: { number: 20, merged: true, title: 'Revert "[AUTO-MERGE] Keel fix for 1 failing test(s)"', body: "Reverts acme/shop#12", head: { ref: "revert-12" } } });
    expect((await one<{ labelled_wrong: boolean }>(db, "select o.labelled_wrong from outcomes o join runs r on r.id = o.run_id where r.pr_number = 12"))!.labelled_wrong).toBe(true);
  });

  it("knows who is signed in from the session cookie", async () => {
    expect((await app.inject("/api/me")).json().user).toBeNull();
    const u = await one<{ id: string }>(db, "insert into users (github_id, login) values (1, 'octo') returning id");
    const sid = await createSession(db, env.SESSION_SECRET, Number(u!.id), { access_token: "ghu_x" });
    expect((await app.inject({ url: "/api/me", cookies: { keel_session: sid } })).json().user.login).toBe("octo");
  });

  it("refreshes expired GitHub tokens, and drops sessions that cannot be refreshed", async () => {
    const { loadSession } = await import("../src/auth/sessions.js");
    const u = await one<{ id: string }>(db, "insert into users (github_id, login) values (2, 'expiring') returning id");
    const sid = await createSession(db, env.SESSION_SECRET, Number(u!.id), { access_token: "old", refresh_token: "r1", expires_at: Date.now() - 1000 });
    const fresh = await loadSession(db, env.SESSION_SECRET, sid, async rt => rt === "r1" ? { access_token: "new", refresh_token: "r2", expires_at: Date.now() + 8 * 3600e3 } : null);
    expect(fresh!.githubToken).toBe("new");
    const sid2 = await createSession(db, env.SESSION_SECRET, Number(u!.id), { access_token: "old", expires_at: Date.now() - 1000 });
    expect(await loadSession(db, env.SESSION_SECRET, sid2, async () => null)).toBeNull();
  });

  it("blocks state-changing calls without the CSRF header or from another origin", async () => {
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix" })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix", headers: { "x-keel": "1", origin: "https://evil.example" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix", headers: { "x-keel": "1" } })).statusCode).toBe(401);
  });

  it("keeps the app behind sign-in and never redirects outside it", async () => {
    const r = await app.inject("/app/repos/acme/shop/settings");
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("/login?next=%2Fapp%2Frepos%2Facme%2Fshop%2Fsettings");
    const { safeNext } = await import("../src/auth/github.js");
    expect(safeNext("/app/repos/a/b")).toBe("/app/repos/a/b");
    expect(safeNext("https://evil.example")).toBe("/app");
    expect(safeNext("//evil.example/app")).toBe("/app");
    expect(safeNext("/app//evil")).toBe("/app");
  });

  it("serves the web app for client-side routes and JSON 404s for server paths", async () => {
    for (const path of ["/", "/results", "/login", "/login?next=%2Fapp"]) {
      const r = await app.inject(path);
      expect(r.statusCode, path).toBe(200);
      expect(r.body).toContain("id=root");
    }
    const asset = await app.inject("/assets/a.js");
    expect(asset.headers["cache-control"]).toContain("immutable");
    expect((await app.inject("/assets/missing.js")).statusCode).toBe(404);
    const api = await app.inject("/api/nope");
    expect(api.statusCode).toBe(404); expect(api.json()).toEqual({ error: "not found" });
  });

  describe("platform pages", () => {
    let sid = "", other = "";
    const as = (url: string, method = "GET", payload?: unknown, who = () => sid) =>
      app.inject({ method: method as any, url, payload: payload as any, cookies: { keel_session: who() }, headers: method === "GET" ? {} : { "x-keel": "1" } });
    beforeAll(async () => {
      // A maintainer of acme/shop whose repo list is already synced (no GitHub calls), and a user who sees nothing.
      const u = await one<{ id: string }>(db, "insert into users (github_id, login, repos_synced_at) values (10, 'maint', now()) returning id");
      await db.query("insert into user_repos (user_id, repo_id, can_manage) select $1, id, true from repos where github_repo_id = 501", [u!.id]);
      sid = await createSession(db, env.SESSION_SECRET, Number(u!.id), { access_token: "ghu_m" });
      const o = await one<{ id: string }>(db, "insert into users (github_id, login, repos_synced_at) values (11, 'stranger', now()) returning id");
      other = await createSession(db, env.SESSION_SECRET, Number(o!.id), { access_token: "ghu_s" });
      const tok = await oidc({ repository: "acme/shop", repository_id: "501", run_id: "9002" });
      await app.inject({ method: "POST", url: "/api/runs", headers: { authorization: `Bearer ${tok}` }, payload: { ...report, decision: "NEEDS REVIEW", pr_number: 13,
        guarantee: "at most 10% of bugs", n_calibration: 120,
        candidates: [{ id: "muse-spark#0", model: "muse-spark", selected: true, applied: true, score: 0.6, tests_passed: 1, tests_total: 1, kept_passing: 3, kept_total: 3,
                       attacks_passed: 2, attacks_total: 4, diff_lines: 4, gates: [], top_factors: [["attack_pass_rate", 0.4]], cost_usd: 0.02 }] } });
    });

    it("lists runs across visible repositories, with filters", async () => {
      const all = (await as("/api/runs")).json();
      expect(all.runs.map((r: any) => r.pr_number).sort()).toEqual([12, 13]);
      expect((await as("/api/runs?decision=review")).json().runs.map((r: any) => r.pr_number)).toEqual([13]);
      expect((await as("/api/runs?outcome=wrong")).json().runs.map((r: any) => r.pr_number)).toEqual([12]);
      expect((await as("/api/runs?decision=bogus")).statusCode).toBe(400);
      expect((await as("/api/runs", "GET", undefined, () => other)).json().runs).toEqual([]);
    });

    it("shows run detail with candidates only to users who can see the repo", async () => {
      const id = (await as("/api/runs?decision=review")).json().runs[0].id;
      const run = (await as(`/api/runs/${id}`)).json().run;
      expect(run.report.candidates[0].model).toBe("muse-spark");
      expect(run.report.n_calibration).toBe(120);
      expect((await as(`/api/runs/${id}`, "GET", undefined, () => other)).statusCode).toBe(404);
    });

    it("lets a maintainer mark a run wrong, behind the CSRF check, and logs it", async () => {
      const id = (await as("/api/runs?decision=review")).json().runs[0].id;
      const noHeader = await app.inject({ method: "POST", url: `/api/runs/${id}/feedback`, payload: { wrong: true }, cookies: { keel_session: sid } });
      expect(noHeader.statusCode).toBe(403);
      expect((await as(`/api/runs/${id}/feedback`, "POST", { wrong: true })).statusCode).toBe(200);
      expect((await as(`/api/runs/${id}/feedback`, "POST", { wrong: true }, () => other)).statusCode).toBe(404);
      const acts = (await as("/api/activity")).json().events.map((e: any) => e.action);
      expect(acts).toContain("marked_wrong");
    });

    it("summarises overview, usage and calibration health", async () => {
      const ov = (await as("/api/overview")).json();
      expect(ov.totals.runs).toBe(2); expect(ov.recent).toHaveLength(2);
      const usage = (await as("/api/usage?days=7")).json();
      expect(usage.daily).toHaveLength(7);
      expect(usage.byModel).toEqual([{ model: "muse-spark", candidates: 1, cost: 0.02, selected: 1 }]);
      const cal = (await as("/api/calibration")).json().repos[0];
      expect(cal).toMatchObject({ repo: "acme/shop", auto_merged: 1, wrong: 1, n_calibration: "120" });
    });

    it("saves defaults, lists sessions without leaking ids, and deletes the account on confirmation", async () => {
      expect((await as("/api/settings", "PUT", { defaults: { alpha: 0.05, method: "ltt", autoMerge: true, models: ["muse-spark"] } })).statusCode).toBe(200);
      expect((await as("/api/settings")).json().defaults).toEqual({ alpha: 0.05, method: "ltt", autoMerge: true, models: ["muse-spark"] });
      expect((await as("/api/settings", "PUT", { defaults: { alpha: 2 } })).statusCode).toBe(400);
      const acct = (await as("/api/account")).json();
      expect(acct.sessions[0].current).toBe(true); expect(acct.sessions[0].id).toHaveLength(10);
      expect((await as("/api/account", "DELETE", { confirm: "nope" })).statusCode).toBe(400);
      expect((await as("/api/account", "DELETE", { confirm: "maint" })).statusCode).toBe(200);
      expect((await as("/api/me")).json().user).toBeNull();
      expect(await one(db, "select 1 from users where login = 'maint'")).toBeNull();
      expect((await one<{ n: number }>(db, "select count(*)::int as n from audit_log where action = 'marked_wrong'"))!.n).toBe(1);
    });
  });

  it("requires sign-in for repository data", async () => {
    expect((await app.inject("/api/repos")).statusCode).toBe(401);
    expect((await app.inject("/api/repos/acme/shop")).statusCode).toBe(401);
  });

  it("prunes old data: candidate tables after 90 days, runs after a year, activity after 90 days", async () => {
    const inst = await one<{ id: string }>(db, "insert into installations (github_installation_id, account_login) values (990, 'prune') returning id");
    const repo = await one<{ id: string }>(db, "insert into repos (installation_id, github_repo_id, full_name) values ($1, 990, 'prune/r') returning id", [inst!.id]);
    const run = (days: number, gh: number) => one<{ id: string }>(db,
      `insert into runs (repo_id, github_run_id, trigger, commit_sha, report, created_at)
       values ($1, $2, 'ci', 'abc', '{"candidates": [{"id": "c"}], "reasons": ["r"]}', now() - make_interval(days => $3::int)) returning id`,
      [repo!.id, gh, days]);
    const fresh = await run(1, 1), old = await run(120, 2), ancient = await run(400, 3);
    await db.query("insert into audit_log (repo_id, action, at) values ($1, 'fix_now', now() - interval '100 days'), ($1, 'fix_now', now())", [repo!.id]);
    const c = await prune(db, { runDetailDays: 90, runDays: 365, auditDays: 90 });
    expect(c).toMatchObject({ runs: 1, details: 1, activity: 1 });
    const report = async (id: string) => (await one<{ report: any }>(db, "select report from runs where id = $1", [id]))?.report;
    expect((await report(fresh!.id)).candidates).toHaveLength(1);
    expect(await report(old!.id)).toEqual({ reasons: ["r"], archived: true });
    expect(await report(ancient!.id)).toBeUndefined();
    expect((await prune(db, { runDetailDays: 90, runDays: 365, auditDays: 90 })).details).toBe(0);  // idempotent
  });
});
