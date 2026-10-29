import { generateKeyPairSync, createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { join } from "node:path";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDb, type Db } from "../src/db/index.js";
import { loadEnv } from "../src/env.js";
import { migrate } from "../src/migrate.js";
import { startFakeGitHub, type FakeState } from "./fake-github.js";

// The real React build (web/dist, live mode) against the real server and a fake GitHub, in Chromium.
// Opt-in: E2E_BROWSER=1 TEST_DATABASE_URL=... npx vitest run test/browser.e2e.test.ts  (needs Playwright and `npm run build` in web/)
const require_ = createRequire(import.meta.url);
const dist = join(__dirname, "..", "..", "web", "dist");
const run = process.env.E2E_BROWSER && process.env.TEST_DATABASE_URL && existsSync(join(dist, "index.html"));
const freePort = () => new Promise<number>(ok => { const s = createServer().listen(0, () => { const p = (s.address() as any).port; s.close(() => ok(p)); }); });

(run ? describe : describe.skip)("web app against the real API (browser)", () => {
  let db: Db, app: Awaited<ReturnType<typeof buildApp>>, gh: Awaited<ReturnType<typeof startFakeGitHub>>, browser: any, page: any, base = "", signer: any;
  const problems: string[] = [];
  const state: FakeState = {
    user: { id: 77, login: "maintainer", avatar_url: "https://avatars.githubusercontent.com/u/77" },
    installation: { id: 900, account: "acme", type: "Organization" },
    repos: [{ id: 501, full_name: "acme/shop", default_branch: "main", private: true, language: "Python", perm: "admin" }],
    tree: ["pyproject.toml", "tests/test_pricing.py", ".github/workflows/ci.yml"], files: { ".github/workflows/ci.yml": "name: CI\non: push\n" },
    publicKey: { key: "", key_id: "kid" }, secrets: {}, written: {}, refs: [], pulls: [], dispatches: [], workflowState: [],
    workflowOnMain: false, expiredTokens: new Set(), tokenCounter: 0,
  };
  const sodium = require_("libsodium-wrappers");
  const go = async (path: string, ready: string) => {
    await page.goto(base + path);
    try { await page.waitForSelector(ready, { timeout: 8000 }); }
    catch (e) { throw new Error(`${path}: "${ready}" did not appear. Page says: ${(await page.textContent("main")).slice(0, 300)} | ${problems.join(" ; ")}`); }
  };

  beforeAll(async () => {
    await sodium.ready; state.publicKey.key = sodium.to_base64(sodium.crypto_box_keypair().publicKey, sodium.base64_variants.ORIGINAL);
    gh = await startFakeGitHub(state);
    const port = await freePort(); base = `http://127.0.0.1:${port}`;
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const env = loadEnv({ DATABASE_URL: process.env.TEST_DATABASE_URL!, SESSION_SECRET: "b".repeat(40), NODE_ENV: "test", APP_URL: base, GITHUB_APP_ID: "1",
      GITHUB_CLIENT_ID: "Iv1.x", GITHUB_CLIENT_SECRET: "s", GITHUB_PRIVATE_KEY: privateKey, GITHUB_WEBHOOK_SECRET: "wh", OIDC_AUDIENCE: "keel.test",
      GITHUB_API_URL: gh.url, GITHUB_WEB_URL: gh.url } as any);
    db = createDb(process.env.TEST_DATABASE_URL!);
    await db.query("drop schema public cascade; create schema public"); await migrate(db, () => {});
    const k = await generateKeyPair("RS256"); signer = k.privateKey;
    app = await buildApp(db, env, { publicDir: dist, jwks: createLocalJWKSet({ keys: [{ ...(await exportJWK(k.publicKey)), kid: "k", alg: "RS256" }] }) });
    await app.listen({ port, host: "127.0.0.1" });
    const { chromium } = require_("playwright");
    browser = await chromium.launch(); page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (e: Error) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m: any) => { if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) problems.push(`console: ${m.text()}`); });
    page.on("response", (r: any) => { if (r.url().includes("/api/") && r.status() >= 400 && !r.url().endsWith("/fix")) problems.push(`api ${r.status()} ${r.url()}`); });
  });
  afterAll(async () => { await browser?.close(); await app?.close(); await db?.end(); await gh?.close(); });

  it("signs in through the real button and lands on the Overview", async () => {
    await page.goto(base + "/app/repos");
    await page.waitForURL(/\/login\?next=/);
    await page.click("text=Continue with GitHub");
    await page.waitForURL(/\/app\/repos$/);
    await page.waitForSelector("text=acme/shop");
    await go("/app", "h1:has-text('Overview')");
  });

  it("sets up a repository with the wizard", async () => {
    await go("/app/repos/acme/shop/settings", "text=Detected configuration");
    for (let i = 0; i < 3; i++) await page.click("button:has-text('Continue')");
    await page.waitForSelector("text=No shared calibration has been published yet");
    await page.click("text=Open setup pull request");
    await page.waitForSelector(".done-card");
    expect(state.pulls).toHaveLength(1);
  });

  it("shows a reported run on the runs, run detail and insight pages", { timeout: 90000 }, async () => {
    const hook = (event: string, payload: unknown) => { const body = JSON.stringify(payload);
      return fetch(base + "/webhooks/github", { method: "POST", body, headers: { "content-type": "application/json", "x-github-event": event,
        "x-hub-signature-256": "sha256=" + createHmac("sha256", "wh").update(body).digest("hex") } }); };
    await hook("pull_request", { action: "closed", repository: { id: 501 }, pull_request: { number: state.pulls[0].number, merged: true, head: { ref: "keel/setup" } } });
    state.workflowOnMain = true;
    const report = JSON.parse(readFileSync(join(__dirname, "fixtures", "run-report.json"), "utf8"));
    const tok = await new SignJWT({ repository: "acme/shop", repository_id: "501", run_id: "9" }).setProtectedHeader({ alg: "RS256", kid: "k" })
      .setIssuer("https://token.actions.githubusercontent.com").setAudience("keel.test").setIssuedAt().setExpirationTime("5m").sign(signer);
    expect((await fetch(base + "/api/runs", { method: "POST", body: JSON.stringify(report), headers: { "content-type": "application/json", authorization: `Bearer ${tok}` } })).status).toBe(201);

    await go("/app/runs", ".runs-list a");
    await page.click(".runs-list a >> nth=0");
    await page.waitForSelector("table.cand-table tbody tr");
    expect(await page.$$eval("table.cand-table tbody tr", (r: any[]) => r.length)).toBe(report.candidates.length);
    await go("/app/repos/acme/shop", ".kpis");
    await page.click("button:has-text('Fix now')");
    await page.waitForSelector("text=Keel run started");
    expect(state.dispatches).toHaveLength(1);
    for (const [path, ready] of [["/app", ".kpis"], ["/app/calibration", "table"], ["/app/usage", ".bars"], ["/app/activity", ".act-list"],
      ["/app/repos/acme/shop/runs", ".runs-list"], ["/app/repos/acme/shop/activity", ".act-list"], ["/app/settings", "text=Signed-in sessions"],
      ["/app/settings/github", "text=Configure on GitHub"], ["/app/settings/defaults", "text=Save defaults"], ["/app/help", "h1:has-text('Help')"]] as const)
      await go(path, ready);
    await go("/app/settings/defaults", "text=Save defaults");
    await page.click("text=Save defaults"); await page.waitForSelector(".ok-text");
  });

  it("produced no page errors, console errors or failed API calls", () => {
    expect(problems).toEqual([]);
  });
});
