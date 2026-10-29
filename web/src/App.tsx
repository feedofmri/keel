import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout, PublicLayout } from "./layouts/PublicLayout";
import { SessionProvider } from "./lib/session";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Results from "./pages/Results";
import RepoOverview from "./pages/app/RepoOverview";
import RepoSettings from "./pages/app/RepoSettings";
import Repositories from "./pages/app/Repositories";

/*
 * Page map. Every route sits in exactly one layout, and the layout owns the header:
 *   Public  (SiteHeader + SiteFooter)  /            Landing
 *                                      /results     Results
 *                                      *            NotFound
 *   Auth    (SiteHeader)               /login       Login
 *   App     (RequireAuth + AppHeader)  /app                              Repositories
 *                                      /app/repos/:owner/:name           Overview
 *                                      /app/repos/:owner/:name/settings  Set up / Settings
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

const router = createBrowserRouter([{
  element: <Root />,
  children: [
    { element: <PublicLayout />, children: [
      { path: "/", element: <Landing /> },
      { path: "/results", element: <Results /> },
      { path: "/results.html", element: <Legacy /> },
      { path: "*", element: <NotFound /> },
    ] },
    { element: <AuthLayout />, children: [
      { path: "/login", element: <Login /> },
      { path: "/login.html", element: <Legacy /> },
    ] },
    { path: "/app", element: <AppLayout />, children: [
      { index: true, element: <Repositories /> },
      { path: "index.html", element: <Legacy /> },
      { path: "repo.html", element: <Legacy /> },
      { path: "setup.html", element: <Legacy /> },
      { path: "repos/:owner/:name", element: <RepoOverview /> },
      { path: "repos/:owner/:name/settings", element: <RepoSettings /> },
      { path: "*", element: <Navigate replace to="/app" /> },
    ] },
  ],
}], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });

export default function App() { return <RouterProvider router={router} />; }
