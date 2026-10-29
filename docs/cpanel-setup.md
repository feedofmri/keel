# Deploying Keel to cPanel (keel.boraqs.com)

Everything (landing page, benchmark dashboard, the app at `/app`, the API) runs as **one Node.js app**
on `keel.boraqs.com`. Repairs still run on each user's own GitHub Actions runners.

Do the steps in order. Never paste secrets into chat or commit them; they go into cPanel or GitHub
secret fields only.

## 1. Subdomain and HTTPS
1. cPanel → **Domains** → *Create A New Domain* → `keel.boraqs.com`. Untick "Share document root" and
   use document root `keel.boraqs.com`.
2. cPanel → **SSL/TLS Status** → select `keel.boraqs.com` → *Run AutoSSL*. Wait until it shows a valid
   certificate.

## 2. PostgreSQL database
1. cPanel → **PostgreSQL Databases** → *Create New Database*: `keel`. cPanel prefixes it, giving e.g.
   `boraqs_keel`.
2. *Add New User*: `keel` with a strong generated password, giving e.g. `boraqs_keel`.
3. *Add User To Database*: give that user **ALL PRIVILEGES** on the database.
4. Your connection string (keep it private):
   `postgres://boraqs_keel:<password>@localhost:5432/boraqs_keel?sslmode=disable`

## 3. Node.js app
cPanel → **Setup Node.js App** → *Create Application*:

| Field | Value |
|---|---|
| Node.js version | the newest offered (22 or later) |
| Application mode | Production |
| Application root | `keel-app` |
| Application URL | `keel.boraqs.com` (path empty) |
| Application startup file | `app.cjs` |

Then add these **Environment variables** in the same screen:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://keel.boraqs.com` |
| `DATABASE_URL` | the connection string from step 2 |
| `SESSION_SECRET` | 64 random characters (generate with any password manager) |
| `OIDC_AUDIENCE` | `keel.boraqs.com` |
| `GITHUB_APP_ID` | from step 4 |
| `GITHUB_APP_SLUG` | from step 4 (the app's URL name, e.g. `keel-ai`) |
| `GITHUB_CLIENT_ID` | from step 4 |
| `GITHUB_CLIENT_SECRET` | from step 4 |
| `GITHUB_WEBHOOK_SECRET` | the webhook secret you chose in step 4 |
| `GITHUB_PRIVATE_KEY` | the private key from step 4. Paste the whole PEM; if the field won't take line breaks, replace them with `\n` |

Click **Save**. Don't run *NPM install* on the server; the deploy uploads ready-built
`node_modules`.

## 4. Register the Keel GitHub App
GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**:

| Field | Value |
|---|---|
| GitHub App name | `Keel` (if taken: `Keel AI`; the slug becomes `keel-ai`) |
| Homepage URL | `https://keel.boraqs.com` |
| Callback URL | `https://keel.boraqs.com/auth/github/callback` |
| Expire user authorization tokens | ✅ (Keel refreshes them) |
| Request user authorization (OAuth) during installation | ✅ |
| Setup URL | `https://keel.boraqs.com/app/` and ✅ Redirect on update |
| Webhook | ✅ Active · URL `https://keel.boraqs.com/webhooks/github` · Secret: a random string (save it for `GITHUB_WEBHOOK_SECRET`) |

**Repository permissions:**
- Actions: Read and write
- Contents: Read and write
- Issues: Read and write
- Metadata: Read
- Pull requests: Read and write
- Secrets: Read and write
- Workflows: Read and write

**Subscribe to events:** Installation target, Pull request, Workflow run. Installation events
are always sent.
**Where can this app be installed:** Any account.

After creating it:
1. Note the **App ID** and **Client ID**.
2. *Generate a new client secret* and note it.
3. *Generate a private key*. A `.pem` file downloads; its contents go into `GITHUB_PRIVATE_KEY`.
4. Put all of these into the cPanel environment variables (step 3) and **restart** the app.

## 5. Deploys from GitHub
Repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `CPANEL_HOST` | your server's hostname (from cPanel's sidebar, e.g. `server123.host.com`) |
| `CPANEL_USER` | your cPanel username |
| `CPANEL_SSH_KEY` | **if you have SSH**: a private key whose public key is authorised in cPanel → SSH Access |
| `CPANEL_SSH_PORT` | only if SSH isn't on port 22 |
| `CPANEL_FTP_PASSWORD` | **if you don't have SSH**: your cPanel/FTP password (FTPS is used) |

Optional **variables**: `CPANEL_APP_DIR` (default `keel-app`), and `CPANEL_FTP_VERIFY_TLS=no` only if
your host's FTP certificate doesn't match its hostname.

Every push to `main` that touches `platform/` or `site/` builds the app and uploads it, then restarts
Passenger. You can also run it by hand: Actions → **Deploy to cPanel** → *Run workflow*. The job ends by
calling `https://keel.boraqs.com/healthz`. Database migrations run automatically when the app starts.

## 6. Maintenance cron (optional)
cPanel → **Cron Jobs** → every 30 minutes:
```
cd ~/keel-app && /home/<cpanel-user>/nodevenv/keel-app/<node-version>/bin/node dist/jobs/maintenance.js
```
cPanel shows the exact `node` path at the top of the Node.js app page ("Enter to the virtual environment").

## 7. Check it
- `https://keel.boraqs.com/healthz` → `{"ok":true}`
- `https://keel.boraqs.com/` → landing page
- `https://keel.boraqs.com/app/` → redirects to `/login.html` → *Continue with GitHub* → Repositories → set up `keel-demo`

## Troubleshooting
- **503 or "Incomplete response":** open `keel-app/stderr.log`. A `ZodError` means an environment
  variable is missing.
- **Sign-in loops back:** `APP_URL` must be exactly `https://keel.boraqs.com`, and the GitHub App
  callback URL must match it.
- **Webhooks 401:** `GITHUB_WEBHOOK_SECRET` must equal the secret set on the GitHub App.
- **Database connection refused:** use `localhost` and `sslmode=disable` for cPanel Postgres.
