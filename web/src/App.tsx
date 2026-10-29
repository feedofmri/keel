import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { DocsLayout } from "./layouts/DocsLayout";
import { AuthLayout, PublicLayout } from "./layouts/PublicLayout";
import { useTitle } from "./hooks/useTitle";
import { SessionProvider } from "./lib/session";
import About from "./pages/About";
import Compare from "./pages/Compare";
import Guarantee from "./pages/Guarantee";
import HowItWorks from "./pages/HowItWorks";
import Landing from "./pages/Landing";
import { Privacy, Terms } from "./pages/Legal";
import Login from "./pages/Login";
import Models from "./pages/Models";
import NotFound from "./pages/NotFound";
import Results from "./pages/Results";
import Security from "./pages/Security";
import CalibrationDocs from "./pages/docs/Calibration";
import Cli from "./pages/docs/Cli";
import Concepts from "./pages/docs/Concepts";
import Configuration from "./pages/docs/Configuration";
import Evaluation from "./pages/docs/Evaluation";
import Faq from "./pages/docs/Faq";
import GitHubAction from "./pages/docs/GitHubAction";
import Quickstart from "./pages/docs/Quickstart";
import Activity from "./pages/app/Activity";
import Calibration from "./pages/app/Calibration";
import Help from "./pages/app/Help";
import Overview from "./pages/app/Overview";
import RepoActivity from "./pages/app/RepoActivity";
import RepoOverview from "./pages/app/RepoOverview";
import RepoRuns from "./pages/app/RepoRuns";
import RepoSettings from "./pages/app/RepoSettings";
import Repositories from "./pages/app/Repositories";
import RunDetail from "./pages/app/RunDetail";
import Runs from "./pages/app/Runs";
import { Danger, DefaultsPage, GitHubAccess, Profile } from "./pages/app/Settings";
import Usage from "./pages/app/Usage";

/*
 * Page map (also in docs/web-pages.md). Every route sits in exactly one layout, and the layout owns the chrome.
 *   Public (SiteHeader + SiteFooter): /, /how-it-works, /guarantee, /models, /compare, /results, /security, /about, /privacy, /terms, 404
 *   Docs   (Public + docs sidebar):   /docs, /docs/concepts, /docs/configuration, /docs/github-action, /docs/calibration, /docs/cli, /docs/evaluation, /docs/faq
 *   Auth   (SiteHeader):              /login
 *   App    (RequireAuth + top bar + sidebar):
 *     /app                                  Overview
 *     /app/repos                            Repositories
 *     /app/repos/:owner/:name               Repository overview   (+ /runs, /activity, /settings)
 *     /app/runs, /app/runs/:id              Runs, run detail
 *     /app/calibration, /app/usage, /app/activity
 *     /app/settings (+ /github, /defaults, /danger), /app/help
 */

// Old static-site URLs keep working.
function Legacy() {
  const { pathname, search } = useLocation();
  const q = new URLSearchParams(search), repo = q.get("repo");
  if (pathname.endsWith("/login.html")) return <Navigate replace to={`/login${search}`} />;
  if (pathname.endsWith("/results.html")) return <Navigate replace to="/results" />;
  if (pathname.endsWith("/repo.html") && repo) return <Navigate replace to={`/app/repos/${repo}`} />;
  if (pathname.endsWith("/setup.html") && repo) return <Navigate replace to={`/app/repos/${repo}/settings`} />;
  return <Navigate replace to="/app" />;
}

function Root() {
  return <SessionProvider><ScrollRestoration getKey={l => l.pathname} /><Outlet /></SessionProvider>;
}

function AppNotFound() {
  useTitle("Page Not Found · Keel");
  return <div className="empty-box" style={{ marginTop: 24 }}><h3>This page doesn't exist</h3><p>It may have moved. Use the sidebar to find your way.</p></div>;
}

const router = createBrowserRouter([{
  element: <Root />,
  children: [
    { element: <PublicLayout />, children: [
      { path: "/", element: <Landing /> },
      { path: "/how-it-works", element: <HowItWorks /> },
      { path: "/guarantee", element: <Guarantee /> },
      { path: "/models", element: <Models /> },
      { path: "/compare", element: <Compare /> },
      { path: "/results", element: <Results /> },
      { path: "/security", element: <Security /> },
      { path: "/about", element: <About /> },
      { path: "/privacy", element: <Privacy /> },
      { path: "/terms", element: <Terms /> },
      { path: "/docs", element: <DocsLayout />, children: [
        { index: true, element: <Quickstart /> },
        { path: "concepts", element: <Concepts /> },
        { path: "configuration", element: <Configuration /> },
        { path: "github-action", element: <GitHubAction /> },
        { path: "calibration", element: <CalibrationDocs /> },
        { path: "cli", element: <Cli /> },
        { path: "evaluation", element: <Evaluation /> },
        { path: "faq", element: <Faq /> },
      ] },
      { path: "/results.html", element: <Legacy /> },
      { path: "*", element: <NotFound /> },
    ] },
    { element: <AuthLayout />, children: [
      { path: "/login", element: <Login /> },
      { path: "/login.html", element: <Legacy /> },
    ] },
    { path: "/app", element: <AppLayout />, children: [
      { index: true, element: <Overview /> },
      { path: "repos", element: <Repositories /> },
      { path: "repos/:owner/:name", element: <RepoOverview /> },
      { path: "repos/:owner/:name/runs", element: <RepoRuns /> },
      { path: "repos/:owner/:name/activity", element: <RepoActivity /> },
      { path: "repos/:owner/:name/settings", element: <RepoSettings /> },
      { path: "runs", element: <Runs /> },
      { path: "runs/:id", element: <RunDetail /> },
      { path: "calibration", element: <Calibration /> },
      { path: "usage", element: <Usage /> },
      { path: "activity", element: <Activity /> },
      { path: "settings", element: <Profile /> },
      { path: "settings/github", element: <GitHubAccess /> },
      { path: "settings/defaults", element: <DefaultsPage /> },
      { path: "settings/danger", element: <Danger /> },
      { path: "help", element: <Help /> },
      { path: "index.html", element: <Legacy /> },
      { path: "repo.html", element: <Legacy /> },
      { path: "setup.html", element: <Legacy /> },
      { path: "*", element: <AppNotFound /> },
    ] },
  ],
}], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });

export default function App() { return <RouterProvider router={router} />; }
