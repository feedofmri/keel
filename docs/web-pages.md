# Web app: pages and components

The web app is React (Vite, TypeScript, React Router) in [`web/`](../web/). Every page sits in exactly
one layout, and the layout owns the header and navigation, so pages in the same zone can't drift apart.

## Public pages

Each page is its own route with its own content; the home page summarises and links to them.

| Route | Page | Content |
|---|---|---|
| `/` | Home | Interactive hero, the four steps, models, guarantee chart, comparison, get started |
| `/how-it-works` | How it works | The pipeline in detail, triggers, the pull request Keel opens, safety rails |
| `/guarantee` | Guarantee | CRC and LTT, how the threshold is calibrated, assumptions, references |
| `/models` | Models | Muse Spark, Muse Spark Open, Muse Glimmer; every signal in the risk score; providers |
| `/compare` | Compare | Keel against Copilot, Seer, Devin/Cursor/Codex, OpenHands, Agentless, Renovate |
| `/results` | Results | Risk slider, KPIs, charts, tables, evaluation method |
| `/security` | Security | Where things run, GitHub App permissions, stored data, safeguards, reporting |
| `/about` | About | Why Keel, what was built during the hackathon, license |
| `/privacy`, `/terms` | Legal | Plain-language privacy and terms |
| `/docs` … | Docs | Quickstart, Concepts, Configuration, GitHub Action, Calibration, CLI, Evaluation, FAQ |
| `/login` | Sign in | GitHub sign-in with the halftone Keel mark |
| `*` | 404 | |

Header (all public pages): How it works · Guarantee · Models · Results · Docs · GitHub · Sign in / Open app,
with a menu button on small screens. No theme toggle; it lives in the footer.
Footer: Product, Developers and Project link columns.

## Platform pages (signed in)

Top bar (brand, theme, account menu) and one sidebar for every page.

| Route | Page | Data |
|---|---|---|
| `/app` | Overview | 30-day KPIs, repositories to finish setting up, review queue, recent runs (`GET /api/overview`) |
| `/app/repos` | Repositories | All repositories the GitHub App can see, filter by status (`GET /api/repos`) |
| `/app/repos/:owner/:name` | Repository · Overview | Status, KPIs, risk budget, recent runs, Fix now / Pause |
| `…/runs` | Repository · Runs | Filterable runs for this repository |
| `…/activity` | Repository · Activity | Audit log for this repository |
| `…/settings` | Repository · Settings | Setup wizard (new) or settings, plus Danger zone: pause/resume, disconnect |
| `/app/runs` | Runs | All runs: All / Needs review / Auto-merged / Open PRs / Wrong, by repository (`GET /api/runs`) |
| `/app/runs/:id` | Run detail | Decision, score vs λ̂, reasons, guarantee, every candidate, failing tests, mark as wrong (`GET /api/runs/:id`, `POST …/feedback`) |
| `/app/calibration` | Calibration | Observed wrong auto-merges per repository against its α (`GET /api/calibration`) |
| `/app/usage` | Usage | Daily model cost, by repository, by model (`GET /api/usage`) |
| `/app/activity` | Activity | Who changed what, across repositories (`GET /api/activity`) |
| `/app/settings` | Settings · Profile | GitHub profile, signed-in sessions, sign out other sessions (`GET /api/account`) |
| `/app/settings/github` | Settings · GitHub access | App installations and links to manage them |
| `/app/settings/defaults` | Settings · Defaults | Default α, method, models, auto-merge for new repositories (`GET/PUT /api/settings`) |
| `/app/settings/danger` | Settings · Danger zone | Delete the Keel account (`DELETE /api/account`) |
| `/app/help` | Help | Guides, support, service status |

Run pages show per-candidate summaries that the Action reports (model, score, tests, adversarial
results, diff size, gates, top factors). No diffs or model output leave the runner.

## Access

- Signed out and opening `/app/...`: the server and the client both redirect to `/login?next=<path>`;
  after sign-in you land back on that path. Only `/app…` paths are accepted as `next`.
- Cross-repository pages only show repositories you can see on GitHub (refreshed every 10 minutes).
  Changing settings, giving feedback on runs, or disconnecting needs admin or maintain access.

## Builds

| Target | Command | Notes |
|---|---|---|
| keel.boraqs.com | `npm run build` in `web/` | Served by the platform server, which returns `index.html` for client-side routes |
| GitHub Pages preview | `BASE_PATH=/keel/ VITE_DEMO=1 npm run build` | Demo mode with sample data for every page; `404.html` makes deep links work |
