import { createHmac } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createSession } from "../src/auth/sessions.js";
import { createDb, one, type Db } from "../src/db/index.js";
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
    app = await buildApp(db, env, { jwks: createLocalJWKSet({ keys: [jwk] }), publicDir: "/nonexistent" });
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

  it("blocks state-changing calls without the CSRF header or from another origin", async () => {
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix" })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix", headers: { "x-keel": "1", origin: "https://evil.example" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/repos/acme/shop/fix", headers: { "x-keel": "1" } })).statusCode).toBe(401);
  });

  it("requires sign-in for repository data", async () => {
    expect((await app.inject("/api/repos")).statusCode).toBe(401);
    expect((await app.inject("/api/repos/acme/shop")).statusCode).toBe(401);
  });
});
