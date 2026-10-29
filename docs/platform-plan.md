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

## 2. Architecture (zero-cost now, portable later)

```
 ┌──────────────── Browser (GitHub Pages: feedofmri.github.io/keel) ─────────────────┐
 │  Landing · /app (sign-in, repo list, setup wizard, repo dashboard) · /dashboard    │
 └───────────────▲───────────────────────────────────────────────┬───────────────────┘
                 │ JSON API (session cookie)                     │ OAuth redirect
 ┌───────────────┴──────────────── Keel API (Cloudflare Worker, free tier) ───────────┐
 │  /auth/*      GitHub App user OAuth → session                                      │
 │  /repos       list installations + repos the user can admin                        │
 │  /setup       detect config, write secrets, open setup PR                          │
 │  /runs        receive run reports from the Action, serve history                   │
 │  /webhook     GitHub App webhooks (installation, workflow_run, pull_request)       │
 │  /fix         dispatch a Keel run on demand (workflow_dispatch)                     │
 │  Storage: Cloudflare D1 (SQLite)  ·  secrets: Worker secrets                       │
 └───────────────▲──────────────────────────────────────────────▲─────────────────────┘
                 │ GitHub REST/GraphQL (installation token)      │ run report (signed)
 ┌───────────────┴──────────── User's GitHub repo ──────────────┴─────────────────────┐
 │  .github/workflows/keel.yml  →  feedofmri/keel@v1 (the existing Action)            │
 │  runs on the USER'S free GitHub runners · tests run in their sandbox · opens PRs   │
 │  model calls → Meta Model API / Baseten, using either the user's keys or a          │
 │  short-lived Keel token for the Keel-hosted quota                                  │
 └────────────────────────────────────────────────────────────────────────────────────┘
```

Why this shape:
- **Compute costs us nothing.** Repairs run on the user's GitHub Actions minutes, which are free for public
  repos and included in every GitHub plan.
- **The engine doesn't change.** The platform is a control plane around the Action we've already built.
- **Code privacy.** Source never leaves GitHub. The API only stores metadata: run status, scores,
  decisions, cost.
- **Portability.** The Worker is plain TypeScript with an SQLite schema, so moving to Fly, Render or Modal
  later is a lift-and-shift.

Alternative if Cloudflare is blocked: **Supabase** (GitHub auth, Postgres, edge functions, free tier).
The design stays the same.

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
- GitHub App user-to-server OAuth: redirect → `code` → token exchange in the Worker.
- Session: an HTTP-only, Secure, SameSite=Lax cookie holding an opaque session id. GitHub tokens are
  stored server-side, encrypted (AES-GCM, key in Worker secrets), and never sent to the browser.
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
   - (b) **Bring your own keys**: the user pastes Meta Model API / Baseten keys. The Worker encrypts
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
  `/runs`. It is signed with an HMAC run secret issued at setup, or with a GitHub OIDC token, which
  needs no stored secret at all.
- **Ground truth for "wrong merge":** the API listens to `pull_request` and push webhooks. A merged
  AUTO-MERGE PR that is reverted, or followed by a CI failure on the same files within 7 days, is counted
  as a likely wrong merge. That feeds the risk-budget gauge and future recalibration.

### 3.6 Data model (D1 / SQLite)
```
users(id, github_id, login, avatar_url, created_at)
sessions(id, user_id, enc_token, expires_at)
installations(id, github_installation_id, account_login, created_at)
repos(id, installation_id, full_name, status, alpha, method, auto_merge, models, calibration_ref,
      quota_used, quota_limit, created_at, activated_at)
runs(id, repo_id, trigger, commit_sha, started_at, finished_at, n_candidates, selected_score,
     threshold, decision, pr_number, cost_usd, report_json)
outcomes(id, run_id, merged_at, reverted_at, followup_ci_failed, labelled_wrong)
audit_log(id, user_id, repo_id, action, at)
```

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
| 1 | Thu Oct 30 | Register the GitHub App; Cloudflare Worker skeleton; D1 schema; GitHub OAuth sign-in/out; `/app` shell on Pages | Sign in with GitHub works |
| 2 | Fri Oct 31 | Repo list (installations); wizard steps Detect + Policy; setup PR creation | Setup PR opens on `keel-demo` |
| 3 | Sat Nov 1 | BYO-keys step (sealed-box secrets); Action posts run reports (OIDC); runs timeline | A real run appears in the dashboard |
| 4 | Sun Nov 2 | Repo dashboard: decisions, risk-budget gauge, cost; "Fix now" dispatch; pause/resume | Full journey end to end |
| 5 | Mon Nov 3 | Hosted-quota proxy (only if credits arrived); polish; record the video around the journey | Demo video recorded |
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
| P1 | A **Cloudflare account** (free). Create an API token with *Workers Scripts: Edit* and *D1: Edit*, and add it as the `CLOUDFLARE_API_TOKEN` repo secret. Also send the account id. Or tell me if you prefer Supabase. | Hosts the API and database for free |
| P2 | **Register the GitHub App** "Keel" with the permissions in §3.1. I'll give you a click-by-click checklist and the manifest. Then send the App ID, client id, client secret and private key as **secrets** (never in chat or the repo). | Sign-in, repo access, setup PRs |
| P3 | Decide on **models for users**: BYO keys only for the hackathon (recommended), or a hosted quota from your credits | Cost exposure |
| P4 | Enable **GitHub Pages** (Settings → Pages → Source: GitHub Actions) | The `/app` frontend lives on Pages |
| P5 | Optional: a custom domain (e.g. `keel.dev`); otherwise `feedofmri.github.io/keel` | Polish |

## 8. Risks
| Risk | Mitigation |
|------|-----------|
| GitHub App review or webhook setup takes time | It doesn't need Marketplace approval; it works immediately for installs by anyone |
| Cloudflare unavailable or blocked | Supabase fallback with the same schema |
| Too much scope for 6 days | The table in §5 is ordered so every day ends with something demoable; the hosted quota is the first thing to cut |
| Secrets handling mistakes | Sealed-box encryption to GitHub, no plaintext stored, a reviewed threat model before launch |
| Rule "identify contributions" | The platform is new code in this repo, listed in `HACKATHON.md` |
