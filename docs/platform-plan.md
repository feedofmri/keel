# Keel Platform: plan

Goal: turn Keel from "copy a workflow file" into a product. A user **signs in with GitHub, picks a
repository, and Keel sets everything up**. From then on they watch fixes, decisions and risk on their
own dashboard.

Constraints that shape the plan:
- **Deadline:** the submission is Wed Nov 4, 9 PM ET. About 6 build days are left, and the existing
  engine, Action and site stay as they are.
- **Cost:** no paid servers until credits arrive. Use free tiers only, and keep a migration path.
- **Rules:** everything is built during the event and stays in the public repo. Every user's code stays
  in *their* GitHub (Keel never copies it to our servers).

---

## 1. User journey

```
Landing page ──► "Sign in with GitHub" ──► Install the Keel GitHub App on chosen repos
      │
      ▼
Setup wizard (per repo)
  1. Detect      language, test command, CI workflow name
  2. Models      Keel-hosted credits (free quota) or bring your own Meta keys
  3. Policy      risk level α, CRC or LTT, label-only vs auto-merge, protected paths
  4. Calibrate   use the shared Keel calibration now; optional "calibrate on my repo's history" later
  5. Activate    Keel opens ONE setup PR (workflow file + .keel.toml) → user merges it
      │
      ▼
Repo dashboard
  live runs · PRs opened (AUTO-MERGE / NEEDS REVIEW) · wrong-merge budget used vs α ·
  cost per fix · "Fix now" button · settings
```

The user never edits YAML. The setup PR is the single, reviewable change Keel makes to their repo, so
the user stays in control and it's easy to demo.

---

## 2. Architecture: Node.js + PostgreSQL

```
 Marketing site (GitHub Pages)              Keel App (one Node.js service, one origin)
 feedofmri.github.io/keel                   e.g. app.keel.dev / keel-app.onrender.com
  landing · /dashboard (benchmarks)  ──►    ┌──────────────────────────────────────────────┐
  "Sign in" button links to the app         │  Web UI  /app  (sign-in, repos, wizard,      │
                                            │          repo dashboard)  served by the same │
                                            │          server → first-party cookies        │
                                            │  API     /api/*   JSON                        │
                                            │  Auth    /auth/github/{login,callback,logout}│
                                            │  Hooks   /webhooks/github  (GitHub App)      │
                                            │  Runs    /api/runs  (reports from the Action)│
                                            │  Jobs    background worker (same codebase):  │
                                            │          outcome tracking, cleanup           │
                                            └──────────────┬───────────────────────────────┘
                                                           │ SQL (TLS)
                                            ┌──────────────▼───────────────────────────────┐
                                            │  PostgreSQL 16                               │
                                            │  users, sessions, installations, repos,      │
                                            │  runs, outcomes, audit_log                   │
                                            └──────────────────────────────────────────────┘
                     GitHub REST/GraphQL (installation tokens)  ▲   run reports (GitHub OIDC)
 ┌───────────────────────────────── User's GitHub repo ─────────┴───────────────────────────┐
 │  .github/workflows/keel.yml → feedofmri/keel@v1 (existing Action) on the USER'S runners    │
 │  model calls → Meta Model API / Baseten with the user's keys (repo secrets)                │
 └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Stack
| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 22 LTS + TypeScript** | Your choice; one language for server and UI |
| Web framework | **Fastify** | Fast, schema validation built in, first-class TypeScript |
| GitHub | **Octokit** (`@octokit/app`, `@octokit/webhooks`) | Official: App auth, installation tokens, webhook signature verification |
| Database | **PostgreSQL 16** | Your choice; JSONB for run reports, row-level ownership checks |
| DB access | **Drizzle ORM** + `node-postgres` + SQL migrations in the repo | Typed queries, plain SQL migrations, no heavy runtime |
| UI | Server-rendered pages + small vanilla-JS islands, reusing the website's design system (`site/assets/style.css`) | Matches the brand, no SPA build pipeline to maintain in 6 days |
| Sessions | Opaque session id in an HTTP-only, Secure, SameSite=Lax cookie; session row in Postgres | First-party (same origin), revocable |
| Secrets crypto | `libsodium-wrappers` (sealed boxes for GitHub repo secrets); AES-256-GCM for stored GitHub user tokens | Matches GitHub's secrets API; nothing stored in plaintext |
| Validation | `zod` | Request and env validation |
| Tests | `vitest` + a Postgres service container in CI | Same CI as the Python engine |
| Container | `Dockerfile` (multi-stage, distroless) | Runs on any host |

### Hosting (free now, portable later)
| Need | Recommended free option | Alternatives |
|---|---|---|
| Node service | **Render** free web service (it sleeps when idle; the first hit takes about 30 s, so warm it before demos) | Fly.io, Railway trial, Koyeb, or Modal web endpoints when credits arrive |
| PostgreSQL | **Neon** free tier (serverless Postgres, branching, doesn't expire) | Supabase Postgres, Render Postgres (free tier expires after 30 days) |
| Domain | `*.onrender.com` now; optional custom domain later | any |

Why this shape:
- **Compute costs us nothing.** Repairs run on the user's GitHub Actions minutes. The Node service only
  coordinates, so a free instance is enough.
- **The engine doesn't change.** The platform is a control plane around the existing Action.
- **Code privacy.** Source never leaves GitHub. Postgres stores only metadata: run status, scores,
  decisions, cost.
- **Portability.** A standard Docker image plus standard Postgres can be moved to Modal, Fly, or a VM
  later without code changes.

### Repository layout (new code, same repo)
```
platform/
  package.json, tsconfig.json, Dockerfile, drizzle.config.ts
  src/
    server.ts            Fastify app, plugins, error handling
    env.ts               zod-validated configuration
    db/schema.ts         Drizzle schema   db/migrations/*.sql
    auth/github.ts       OAuth login/callback/logout, sessions
    github/app.ts        Octokit App, installation tokens
    github/webhooks.ts   installation, workflow_run, pull_request, issue_comment
    setup/detect.ts      detect test command, CI workflow, language
    setup/pr.ts          build + open the setup PR (keel.yml, .keel.toml)
    setup/secrets.ts     sealed-box encryption → repo secrets
    runs/report.ts       verify GitHub OIDC token, store run reports
    runs/outcomes.ts     mark reverted / later-failed auto-merges
    ui/pages/*.ts        server-rendered pages (sign-in, repos, wizard, repo dashboard)
    ui/static/*          JS islands (α slider, live runs)
  test/*.test.ts
```

---

## 3. Components

### 3.1 Keel GitHub App
Registered once, by you.

| Permission | Level | Why |
|---|---|---|
| Contents | Read & write | Open the setup PR and fix branches |
| Pull requests | Read & write | Open and label PRs |
| Issues | Read & write | Comments, labels |
| Actions | Read & write | Dispatch runs, read run status |
| Secrets | Read & write | Store the user's Meta keys as repo secrets (encrypted with the repo's public key) |
| Workflows | Read & write | Add `.github/workflows/keel.yml` in the setup PR |
| Metadata | Read | Required |

**Webhooks:** `installation`, `installation_repositories`, `workflow_run`, `pull_request`,
`issue_comment`.
**User OAuth:** on ("Request user authorization during installation"). Sign-in and install become
one step.

### 3.2 Auth
- GitHub App user-to-server OAuth: `/auth/github/login` redirects to GitHub with a `state` nonce; the
  callback exchanges the `code` on the Node server.
- Session: a random 256-bit id in an HTTP-only, Secure, SameSite=Lax cookie (first-party, because the
  UI and API share one origin), backed by a `sessions` row in Postgres. GitHub user tokens are stored
  encrypted with AES-256-GCM (the key is in server env), refreshed when they expire, and never sent to
  the browser.
- Authorisation on every request: the user must have **admin or maintain** permission on the repo,
  checked live against GitHub.
- CSRF: a SameSite cookie plus a per-session token header on state-changing calls.

### 3.3 Setup wizard (`/app/setup/:repo`)
1. **Detect.** Read the repo tree through the API to guess the language (Python only in v1), the test
   command (`pytest`, `tox`, a `Makefile` test target) and the CI workflow name. Show a short
   "here's what we found" summary with edit fields.
2. **Models.**
   - (a) **Keel-hosted quota**: N free repairs a month, paid from our credits, with a hard per-repo
     cap. The Action exchanges a short-lived run token with the API, and the API proxies model calls,
     so our keys never reach user runners.
   - (b) **Bring your own keys**: the user pastes Meta Model API / Baseten keys. The server encrypts
     them with the repo's public key (libsodium sealed box) and writes them as repo secrets. Keel never
     stores the plaintext.
3. **Policy.** A risk-level slider (the same component as the website), CRC or LTT, label-only or
   GitHub auto-merge, and protected paths. Preview: "with α = 10%, the shared calibration would
   auto-merge about X% of fixes".
4. **Calibration.**
   - **Shared:** the calibration from QuixBugs and SWE-bench Lite, shipped in the Action.
   - **Repo-specific (later):** replay the repo's own past bug-fix commits as tasks to build its own
     calibration. This tightens the exchangeability assumption.
5. **Activate.** Open the setup PR containing `keel.yml` and `.keel.toml`, with a friendly description.
   When the user merges it, the repo shows as "Active".

### 3.4 Repo dashboard (`/app/repo/:owner/:name`)
- **Status:** active or paused, last run, the current α and its calibration.
- **Runs:** a timeline of each failing CI run → candidates → decision → PR link, with the score and
  reasons.
- **Risk budget:** a gauge showing observed wrong merges (reverted or failed later) against the α
  budget. This is the honest live view of the guarantee.
- **Cost:** spend per fix and per auto-merge, for each Meta model.
- **Actions:** "Fix now" (dispatches a run), pause or resume, change policy (opens a small PR updating
  `.keel.toml`).

### 3.5 Run reporting (Action → API)
- After each run, the Action posts a compact report (scores, decision, cost, PR number) to
  `/runs`. It is authenticated with a **GitHub Actions OIDC token** (`id-token: write`). The server verifies
  the token against GitHub's JWKS and checks that its `repository` claim matches the repo. No shared
  secret is needed.
- **Ground truth for "wrong merge":** the API listens to `pull_request` and push webhooks. A merged
  AUTO-MERGE PR that is reverted, or followed by a CI failure on the same files within 7 days, is counted
  as a likely wrong merge. That feeds the risk-budget gauge and future recalibration.

### 3.6 Data model (PostgreSQL)
```sql
create table users (
  id bigserial primary key, github_id bigint unique not null, login text not null,
  avatar_url text, created_at timestamptz not null default now());
create table sessions (
  id text primary key, user_id bigint not null references users on delete cascade,
  enc_github_token bytea not null, token_expires_at timestamptz, expires_at timestamptz not null,
  created_at timestamptz not null default now());
create table installations (
  id bigserial primary key, github_installation_id bigint unique not null,
  account_login text not null, account_type text not null, suspended boolean not null default false,
  created_at timestamptz not null default now());
create table repos (
  id bigserial primary key, installation_id bigint not null references installations on delete cascade,
  github_repo_id bigint unique not null, full_name text not null,
  status text not null default 'new' check (status in ('new','setup_pr_open','active','paused','error')),
  alpha numeric(4,3) not null default 0.100, method text not null default 'crc',
  auto_merge boolean not null default false, models text[] not null default '{muse-spark,muse-spark-open}',
  test_command text, ci_workflow text, setup_pr_number int, calibration_ref text not null default 'shared-v1',
  created_by bigint references users, created_at timestamptz not null default now(), activated_at timestamptz);
create table runs (
  id bigserial primary key, repo_id bigint not null references repos on delete cascade,
  github_run_id bigint, trigger text not null, commit_sha text not null,
  started_at timestamptz, finished_at timestamptz,
  n_candidates int, selected_score double precision, threshold double precision,
  decision text check (decision in ('AUTO-MERGE','NEEDS REVIEW')), pr_number int,
  cost_usd numeric(10,4), report jsonb not null default '{}',
  unique (repo_id, github_run_id));
create table outcomes (
  run_id bigint primary key references runs on delete cascade,
  merged_at timestamptz, reverted_at timestamptz, followup_ci_failed boolean, labelled_wrong boolean);
create table audit_log (
  id bigserial primary key, user_id bigint references users, repo_id bigint references repos,
  action text not null, detail jsonb, at timestamptz not null default now());
create index on runs (repo_id, started_at desc);
```
Every query that touches a repo first checks the signed-in user's live GitHub permission on it
(admin or maintain to change settings, read to view). The server never trusts a client-supplied repo id.

---

## 4. Security and trust

- **Least privilege.** Repo-scoped installation tokens (valid for 1 hour), minted per request. Nothing
  touches repos the user didn't select.
- **No code storage.** Only metadata is stored. Reports exclude diffs. The PR on GitHub is the record.
- **Secrets.** BYO keys go straight into GitHub repo secrets (sealed box). Hosted-quota model calls
  go through our proxy, so our keys never reach a runner.
- **Untrusted code.** Tests run in the user's own runner with secrets scrubbed, as Keel already does.
  The setup PR pins `feedofmri/keel@v1` to a commit SHA.
- **Abuse limits.** Quota per repo and per user, `/keel fix` only from users with write access, and
  rate limits on the API.
- **Transparency.** An audit log of every write Keel makes, shown in the dashboard.

---

## 5. Scope for the hackathon (by Nov 4) vs. later

| Day | Date | Platform work | Exit check |
|-----|------|---------------|-----------|
| 1 | Thu Oct 30 | `platform/` scaffold (Fastify + TS + Drizzle); Postgres schema and migrations; Neon + Render deploy; GitHub App registered; OAuth sign-in/out with sessions | Sign in with GitHub on the live app |
| 2 | Fri Oct 31 | Installations and repo list; wizard steps Detect + Policy; setup PR creation | Setup PR opens on `keel-demo` |
| 3 | Sat Nov 1 | BYO-keys step (sealed-box repo secrets); Action posts run reports (OIDC); webhooks; runs timeline | A real run appears in the dashboard |
| 4 | Sun Nov 2 | Repo dashboard: decisions, risk-budget gauge, cost; "Fix now" (workflow_dispatch); pause/resume; outcome tracking | Full journey end to end |
| 5 | Mon Nov 3 | Polish, tests (vitest + Postgres in CI), security review; record the video around the journey | Demo video recorded |
| 6 | Tue Nov 4 | Hardening, docs, submit by 6 PM ET | Submitted |

**In for the hackathon:** GitHub sign-in, install, wizard, setup PR, BYO keys, run reports, repo dashboard,
"Fix now".
**After:**
- hosted quota with billing
- repo-specific calibration from commit history
- org/team views
- GitLab support
- languages beyond Python
- Slack and email alerts
- trust-layer mode for PRs written by *other* agents (Copilot, Devin)

The benchmark and the existing Action keep running unchanged in parallel.

---

## 6. Demo-video beat this unlocks
"Sign in with GitHub → pick `keel-demo` → slide α to 10% → Activate → merge the setup PR → push a
bug → watch the run appear live on the Keel dashboard → AUTO-MERGE PR." It shows real product polish
end to end in under 60 seconds.

---

## 7. What I need from you

| # | What | Why |
|---|------|-----|
| P1 | A **Neon** account (free) and a project named `keel`. Add its connection string as the `DATABASE_URL` secret, in the hosting provider and as a GitHub secret for migrations. Or another Postgres you prefer. | The database |
| P2 | A **Render** account (free), connected to the GitHub repo, so I can give you a `render.yaml` blueprint for one-click deploy. Or tell me Fly or Railway instead. | Hosts the Node service |
| P3 | **Register the GitHub App** "Keel" with the permissions in §3.1. I'll give you a click-by-click checklist and the manifest. Its App ID, client id, client secret, webhook secret and private key go in as host **secrets** (never in chat or the repo). | Sign-in, repo access, setup PRs |
| P4 | Decide on **models for users**: BYO keys only for the hackathon (recommended), or a hosted quota from your credits | Cost exposure |
| P5 | Enable **GitHub Pages** (Settings → Pages → Source: GitHub Actions) | The marketing site |
| P6 | Optional: a custom domain (e.g. `app.keel.dev`) | Polish |

## 8. Risks
| Risk | Mitigation |
|------|-----------|
| GitHub App review or webhook setup takes time | It doesn't need Marketplace approval; it works immediately for installs by anyone |
| Free Render instance sleeps when idle | Warm it before demos, or switch to a paid or credit-backed host; Neon autosuspend wakes in under a second |
| Too much scope for 6 days | The table in §5 is ordered so every day ends with something demoable; the hosted quota is the first thing to cut |
| Secrets handling mistakes | Sealed-box encryption to GitHub, no plaintext stored, a reviewed threat model before launch |
| Rule "identify contributions" | The platform is new code in this repo, listed in `HACKATHON.md` |
