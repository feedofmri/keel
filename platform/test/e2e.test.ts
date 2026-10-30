import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDb, one, type Db } from "../src/db/index.js";
import { loadEnv } from "../src/env.js";
import { migrate } from "../src/migrate.js";
import { renderKeelToml } from "../src/setup/files.js";
import { sharedCalibration } from "../src/setup/calibration.js";
import { startFakeGitHub, type FakeState } from "./fake-github.js";

const sodium: typeof import("libsodium-wrappers") = createRequire(import.meta.url)("libsodium-wrappers");
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
const report = JSON.parse(readFileSync(join(__dirname, "fixtures", "run-report.json"), "utf8"));

/**
 * The whole platform against a fake GitHub: sign-in, repository sync, detection, encrypted secrets,
 * the setup pull request, webhooks, the Action's run report (the payload the Python Action really
 * sends), the runs pages, feedback, Fix now, pause/resume, error handling, rate limits and headers.
 */
d("platform end to end (fake GitHub)", () => {
  let db: Db, app: Awaited<ReturnType<typeof buildApp>>, gh: Awaited<ReturnType<typeof startFakeGitHub>>, signer: any;
  let cookie = "", repoKeys: { publicKey: Uint8Array; privateKey: Uint8Array };
  const state: FakeState = {
    user: { id: 4242, login: "maintainer", avatar_url: "https://avatars.githubusercontent.com/u/4242" },
    installation: { id: 900, account: "acme", type: "Organization" },
    repos: [{ id: 501, full_name: "acme/shop", default_branch: "main", private: true, language: "Python", perm: "admin" },
            { id: 502, full_name: "acme/docs", default_branch: "main", private: false, language: "Python", perm: "read" }],
    tree: ["pyproject.toml", "src/shop/pricing.py", "tests/test_pricing.py", ".github/workflows/ci.yml"],
    files: { ".github/workflows/ci.yml": "name: CI\non: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pytest -q\n" },
    publicKey: { key: "", key_id: "kid-1" }, secrets: {}, written: {}, refs: [], pulls: [], dispatches: [], workflowState: [],
    workflowOnMain: false, expiredTokens: new Set(), tokenCounter: 0,
  };
  const req = (method: string, path: string, payload?: unknown, extra: Record<string, string> = {}) =>
    app.inject({ method: method as any, url: path, payload: payload as any, headers: { cookie, ...(method === "GET" ? {} : { "x-keel": "1" }), ...extra } });
  const hook = (event: string, payload: unknown) => {
    const body = JSON.stringify(payload);
    return app.inject({ method: "POST", url: "/webhooks/github", payload: body, headers: { "content-type": "application/json", "x-github-event": event,
      "x-hub-signature-256": "sha256=" + createHmac("sha256", "whsec").update(body).digest("hex") } });
  };

  beforeAll(async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair(); repoKeys = { publicKey: kp.publicKey, privateKey: kp.privateKey };
    state.publicKey.key = sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL);
    gh = await startFakeGitHub(state);
    const { privateKey: appKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const env = loadEnv({ DATABASE_URL: url!, SESSION_SECRET: "e".repeat(40), NODE_ENV: "test", APP_URL: "https://keel.example",
      GITHUB_APP_ID: "12345", GITHUB_APP_SLUG: "keel-test", GITHUB_CLIENT_ID: "Iv1.test", GITHUB_CLIENT_SECRET: "secret", GITHUB_PRIVATE_KEY: appKey,
      GITHUB_WEBHOOK_SECRET: "whsec", OIDC_AUDIENCE: "keel.example", GITHUB_API_URL: gh.url, GITHUB_WEB_URL: gh.url } as any);
    db = createDb(url!);
    await db.query("drop schema public cascade; create schema public");
    await migrate(db, () => {});
    const { publicKey, privateKey } = await generateKeyPair("RS256"); signer = privateKey;
    const pub = mkdtempSync(join(tmpdir(), "keel-e2e-")); mkdirSync(join(pub, "assets"));
    writeFileSync(join(pub, "index.html"), "<!doctype html><script>try{1}catch(e){}</script><div id=root></div>");
    app = await buildApp(db, env, { jwks: createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] }), publicDir: pub });
  });
  afterAll(async () => { await app?.close(); await db?.end(); await gh?.close(); });

  it("signs in with GitHub and protects the state parameter", async () => {
    const login = await app.inject("/auth/github/login?next=%2Fapp%2Frepos");
    expect(login.statusCode).toBe(302);
    const loc = new URL(login.headers.location as string);
    expect(loc.origin + loc.pathname).toBe(`${gh.url}/login/oauth/authorize`);
    expect(loc.searchParams.get("redirect_uri")).toBe("https://keel.example/auth/github/callback");
    const jar = (login.headers["set-cookie"] as string[]).map(c => c.split(";")[0]).join("; ");
    const tampered = await app.inject({ url: `/auth/github/callback?code=ok&state=wrong`, headers: { cookie: jar } });
    expect(tampered.statusCode).toBe(400);
    const cb = await app.inject({ url: `/auth/github/callback?code=ok&state=${loc.searchParams.get("state")}`, headers: { cookie: jar } });
    expect(cb.statusCode).toBe(302);
    expect(cb.headers.location).toBe("/app/repos");
    cookie = (cb.headers["set-cookie"] as string[]).map(c => c.split(";")[0]).find(c => c.startsWith("keel_session="))!;
    expect((await req("GET", "/api/me")).json().user.login).toBe("maintainer");
  });

  it("handles the return from installing the App on github.com without trusting its code", async () => {
    // GitHub starts this flow, so there is no state cookie: never a sign-in from this code.
    const out = await app.inject("/auth/github/callback?code=ok&installation_id=900&setup_action=install");
    expect(out.statusCode).toBe(302);
    expect(out.headers.location).toBe("/auth/github/login?next=%2Fapp%2Frepos");
    expect(out.headers["set-cookie"] ?? []).not.toEqual(expect.arrayContaining([expect.stringMatching(/^keel_session=[^;]/)]));
    const signedIn = await app.inject({ url: "/auth/github/callback?code=ok&installation_id=900&setup_action=install", headers: { cookie } });
    expect(signedIn.statusCode).toBe(302);
    expect(signedIn.headers.location).toBe("/app/repos");
  });

  it("lists repositories the user can see, with their permissions and installation", async () => {
    const r = (await req("GET", "/api/repos")).json();
    expect(r.repos.map((x: any) => [x.full_name, x.status, x.canManage])).toEqual([["acme/shop", "new", true], ["acme/docs", "new", false]]);
    expect(r.installations[0]).toMatchObject({ id: 900, account: "acme" });
    expect((await req("GET", "/api/repos/acme/docs/detect")).statusCode).toBe(403);
  });

  it("detects the project and refuses Fix now before the workflow is merged", async () => {
    const det = (await req("GET", "/api/repos/acme/shop/detect")).json().detection;
    expect(det).toMatchObject({ language: "python", ciWorkflow: "CI" });
    const fix = await req("POST", "/api/repos/acme/shop/fix", {});
    expect(fix.statusCode).toBe(409);
    expect(fix.json().error).toMatch(/Merge the setup pull request/);
  });

  it("opens the setup pull request with the workflow, policy and encrypted secrets", async () => {
    const r = await req("POST", "/api/repos/acme/shop/setup", { alpha: 0.1, method: "crc", autoMerge: false, models: ["muse-spark", "muse-spark-open"],
      ciWorkflow: "CI", installCommand: "pip install -e . pytest", secrets: { KEEL_MUSE_SPARK_API_KEY: "sk-real-key", KEEL_GLIMMER_API_KEY: "not-selected" } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ pr: { number: 7 }, secretsStored: ["KEEL_MUSE_SPARK_API_KEY"], calibration: null });
    // the secret reached GitHub sealed for the repository key, and decrypts to the value entered
    const sealed = sodium.from_base64(state.secrets.KEEL_MUSE_SPARK_API_KEY.encrypted_value, sodium.base64_variants.ORIGINAL);
    expect(sodium.to_string(sodium.crypto_box_seal_open(sealed, repoKeys.publicKey, repoKeys.privateKey))).toBe("sk-real-key");
    expect(state.secrets.KEEL_GLIMMER_API_KEY).toBeUndefined();
    const wf = state.written[".github/workflows/keel.yml"];
    expect(wf).toMatch(/workflows: \[.*CI.*\]/);
    expect(wf).toContain("id-token: write");
    expect(wf).toContain("KEEL_PLATFORM_URL: https://keel.example");
    expect(wf).toContain("pip install -e . pytest");
    expect(state.written[".keel.toml"]).toContain("alpha = 0.10");
    expect(state.written[".keel.toml"]).not.toContain("calibration =");
    expect(state.pulls[0].body).toMatch(/no shared calibration has been published yet/);
    expect((await one<any>(db, "select status, calibration_ref from repos where github_repo_id = 501"))).toEqual({ status: "setup_pr_open", calibration_ref: "none" });
  });

  it("goes live when the setup pull request is merged", async () => {
    await hook("pull_request", { action: "closed", repository: { id: 501 }, pull_request: { number: 7, merged: true, head: { ref: "keel/setup" } } });
    state.workflowOnMain = true;
    expect((await req("GET", "/api/repos/acme/shop")).json().repo.status).toBe("active");
  });

  it("accepts the Action's run report and shows it on every runs page", async () => {
    const tok = await new SignJWT({ repository: "acme/shop", repository_id: "501", run_id: "777001" }).setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://token.actions.githubusercontent.com").setAudience("keel.example").setIssuedAt().setExpirationTime("5m").sign(signer);
    const r = await app.inject({ method: "POST", url: "/api/runs", payload: report, headers: { authorization: `Bearer ${tok}` } });
    expect(r.statusCode, r.body).toBe(201);
    const runs = (await req("GET", "/api/runs")).json().runs;
    expect(runs).toHaveLength(1);
    const run = (await req("GET", `/api/runs/${runs[0].id}`)).json().run;
    expect(run.decision).toBe(report.decision);
    expect(run.report.candidates).toHaveLength(report.candidates.length);
    expect(run.report.candidates.filter((c: any) => c.selected)).toHaveLength(1);
    const ov = (await req("GET", "/api/overview")).json();
    expect(ov.totals.runs).toBe(1);
    expect((await req("GET", "/api/usage?days=7")).json().byModel.length).toBeGreaterThan(0);
    expect((await req("GET", "/api/calibration")).json().repos[0]).toMatchObject({ repo: "acme/shop", runs: 1 });
  });

  it("records merges of Keel's fix pull requests and feedback from maintainers", async () => {
    await hook("pull_request", { action: "closed", repository: { id: 501 }, pull_request: { number: 41, merged: true, head: { ref: "keel/fix-777001" }, title: "[NEEDS REVIEW] Keel fix", body: "" } });
    const run = (await req("GET", "/api/runs")).json().runs[0];
    expect(run.merged_at).not.toBeNull();
    expect((await req("POST", `/api/runs/${run.id}/feedback`, { wrong: true })).statusCode).toBe(200);
    expect((await req("GET", "/api/runs?outcome=wrong")).json().runs).toHaveLength(1);
  });

  it("runs Fix now and pauses and resumes the workflow", async () => {
    expect((await req("POST", "/api/repos/acme/shop/fix", {})).statusCode).toBe(200);
    expect(state.dispatches).toEqual(["keel.yml@main"]);
    expect((await req("POST", "/api/repos/acme/shop/pause", {})).statusCode).toBe(200);
    expect((await req("GET", "/api/repos/acme/shop")).json().repo.status).toBe("paused");
    expect((await req("POST", "/api/repos/acme/shop/resume", {})).statusCode).toBe(200);
    expect(state.workflowState).toEqual(["disable", "enable"]);
    const acts = (await req("GET", "/api/activity")).json().events.map((e: any) => e.action);
    expect(acts).toEqual(expect.arrayContaining(["setup_pr", "fix_now", "pause", "resume", "marked_wrong"]));
  });

  it("returns a repository to 'not set up' when its setup pull request is closed unmerged", async () => {
    await db.query("update repos set status = 'setup_pr_open', setup_pr_number = 8 where github_repo_id = 502");
    await hook("pull_request", { action: "closed", repository: { id: 502 }, pull_request: { number: 8, merged: false, head: { ref: "keel/setup" } } });
    expect(await one(db, "select status, setup_pr_number from repos where github_repo_id = 502")).toEqual({ status: "new", setup_pr_number: null });
  });

  it("explains an expired GitHub authorisation instead of failing with a 500", async () => {
    await db.query("update users set repos_synced_at = null");
    state.expiredTokens.add(`ghu_user_${state.tokenCounter}`);
    const r = await req("GET", "/api/repos");
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toMatch(/sign in again/i);
    state.expiredTokens.clear();
  });

  it("sends security headers and rate-limits sign-in", async () => {
    const page = await app.inject("/results");
    expect(page.headers["content-security-policy"]).toMatch(/script-src 'self' 'sha256-/);
    expect(page.headers["strict-transport-security"]).toContain("max-age=");
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await app.inject({ url: "/auth/github/login", remoteAddress: "10.9.9.9" })).statusCode;
    expect(last).toBe(429);
    expect((await app.inject({ url: "/auth/github/login", remoteAddress: "10.9.9.10" })).statusCode).toBe(302);
  });
});

describe("shared calibration delivery", () => {
  it("refuses simulated calibrations and adds real ones to .keel.toml", () => {
    const dir = mkdtempSync(join(tmpdir(), "keel-cal-"));
    writeFileSync(join(dir, "sim.json"), JSON.stringify({ simulated: true, scores: [0.1], wrong: [false], fingerprint: "abc", source: "simulated" }));
    writeFileSync(join(dir, "real.json"), JSON.stringify({ simulated: false, scores: [0.1, 0.2], wrong: [false, true], fingerprint: "abc", source: "quixbugs" }));
    expect(sharedCalibration(join(dir, "sim.json"))).toBeNull();
    expect(sharedCalibration(join(dir, "real.json"))).toMatchObject({ n: 2, source: "quixbugs", fingerprint: "abc" });
    const toml = renderKeelToml({ alpha: 0.1, method: "crc", autoMerge: false, models: ["muse-spark"], ciWorkflow: "CI", installCommand: "pip install .", testCommand: "pytest", calibration: ".keel/calibration.json" });
    expect(toml).toContain('calibration = ".keel/calibration.json"');
  });
});
