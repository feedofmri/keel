import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { KeelMark } from "../components/Logo";
import { HalftoneCanvas } from "../components/HalftoneCanvas";
import { useTitle } from "../hooks/useTitle";
import { api } from "../lib/api";
import { BASE, DEMO } from "../lib/env";
import { useSession } from "../lib/session";
import "../styles/login.css";

/** Only in-app paths are allowed as a post-login destination (no open redirects). */
export function safeNext(n: string | null): string {
  return n && /^\/app(\/|$)/.test(n) && !n.startsWith("//") ? n : "/app";
}

const GH = "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

export default function Login() {
  useTitle("Sign In to Keel");
  const { me, loading, refresh } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  if (!loading && me?.user) return <Navigate replace to={next} />;

  // The server's sign-in route lives outside the SPA, so it gets the full path including the base.
  const href = `/auth/github/login?next=${encodeURIComponent(BASE.replace(/\/$/, "") + next)}`;
  // Back returns to the previous page in this tab, or to the home page when sign-in was opened directly.
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));
  const demoSignIn = async (e: React.MouseEvent) => { e.preventDefault(); api.demoSignIn(); await refresh(); navigate(next, { replace: true }); };

  return (
    <div className="page-login">
      <div className="login">
        <section className="main">
          <div className="login-top">
            <button type="button" className="back" onClick={back}>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>Back
            </button>
            <Link className="brand" to="/" aria-label="Keel home"><KeelMark />Keel</Link>
          </div>
          <div className="card-login">
          <h1>Sign in to Keel</h1>
          <p className="p-large">Use your GitHub account to connect repositories and configure Keel.</p>
          <a className="btn primary gh" href={DEMO ? "#" : href} onClick={DEMO ? demoSignIn : undefined}>
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={GH} /></svg>Continue with GitHub</a>
          <p className="fine">{DEMO
            ? "Demo mode: this opens the application with sample data. The production service is available at keel.boraqs.com."
            : "Keel can access only the repositories you select when installing the GitHub App. Your source code remains on GitHub."}</p>
        </div></section>
        <aside className="side inv">
          <HalftoneCanvas className="field" pitch={9} scale={0.8} />
          <div className="cols">
            <div><h4>1 · Install the GitHub App</h4><p className="p-small">Select the repositories Keel may access.</p></div>
            <div><h4>2 · Configure the policy</h4><p className="p-small">Choose the risk level, the Meta models and the merge behaviour.</p></div>
            <div><h4>3 · Merge the setup pull request</h4><p className="p-small">Keel adds a workflow and a configuration file to the repository.</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
