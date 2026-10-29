# Web app: pages and components

The web app is React (Vite, TypeScript, React Router) in [`web/`](../web/). Every page sits in exactly
one layout, and the layout owns the header, so two pages in the same zone can't have different
navigation.

## Pages

| Zone | Route | Page | Layout |
|---|---|---|---|
| Public | `/` | Landing: hero, how it works, models, guarantee, comparison, get started | `PublicLayout` |
| Public | `/results` | Benchmark results: risk slider, KPIs, charts, tables | `PublicLayout` |
| Public | `*` | Not found | `PublicLayout` |
| Sign-in | `/login` | Sign in with GitHub (halftone Keel mark) | `AuthLayout` |
| App | `/app` | Repositories | `AppLayout` |
| App | `/app/repos/:owner/:name` | Repository overview: KPIs, risk budget, runs | `AppLayout` |
| App | `/app/repos/:owner/:name/settings` | Setup wizard (new repository) or Settings tab | `AppLayout` |

Old URLs (`/login.html`, `/results.html`, `/app/repo.html?repo=…`, `/app/setup.html?repo=…`) redirect
to the new routes.

## Layouts

- **PublicLayout**: `SiteHeader` + page + `SiteFooter`.
- **AuthLayout**: `SiteHeader` + page (the sign-in page fills the screen, so it has no footer).
- **AppLayout**: `RequireAuth` → `DemoBanner` + `AppHeader` + page.

`SiteHeader` is the same on every public page: How it works, Guarantee, Results, GitHub, then Sign in
(or Open app when signed in) and the theme toggle. It turns dark while it sits over a section marked
`data-dark-zone`, so pages never style the header themselves.

`AppHeader` is the same on every app page: Repositories, the theme toggle and the account menu
(Keel website, Benchmark results, Manage GitHub access, Sign out).

## Access

- Signed out and opening `/app/...`: the server (cPanel) and the client both redirect to
  `/login?next=<path>`; after sign-in you land back on that path. Only `/app…` paths are accepted as
  `next`.
- Signed in and opening `/login`: redirect to `/app`.

## Builds

| Target | Command | Notes |
|---|---|---|
| keel.boraqs.com | `npm run build` in `web/` | Served by the platform server (`platform/`), which returns `index.html` for client-side routes |
| GitHub Pages preview | `BASE_PATH=/keel/ VITE_DEMO=1 npm run build` | Demo mode with sample data; `404.html` makes deep links work |
