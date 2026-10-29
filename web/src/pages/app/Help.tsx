import { Link } from "react-router-dom";
import { PageHead } from "../../components/PageHead";
import { useTitle } from "../../hooks/useTitle";
import { REPO_URL } from "../../lib/env";
import { useSession } from "../../lib/session";

const LINKS = [
  { to: "/docs", title: "Quickstart", text: "Connect a repository and get your first labelled fix." },
  { to: "/docs/configuration", title: "Configuration", text: "Every .keel.toml key, with defaults." },
  { to: "/docs/github-action", title: "GitHub Action", text: "Inputs, triggers and permissions." },
  { to: "/docs/calibration", title: "Calibration", text: "Build and refresh a calibration." },
  { to: "/guarantee", title: "The guarantee", text: "What α promises, and what it assumes." },
  { to: "/docs/faq", title: "FAQ", text: "Short answers to common questions." },
];

export default function Help() {
  useTitle("Help · Keel");
  const { me } = useSession();
  return (
    <>
      <PageHead title="Help" sub="Guides, answers, and where to get support." />
      <div className="next-grid" style={{ marginTop: 0 }}>
        {LINKS.map(l => <Link key={l.to} to={l.to} className="next-card"><h4>{l.title} <span className="arrow">→</span></h4><p className="p-small">{l.text}</p></Link>)}
      </div>
      <div className="grid2" style={{ marginTop: 40 }}>
        <div className="panel-box"><h3>Something not working?</h3>
          <p className="p-small">Open an issue with the run id (it's on every run page) and what you expected. Please don't include API keys.</p>
          <div className="row-actions"><a className="btn" href={`${REPO_URL}/issues/new`}>Open an issue</a></div></div>
        <div className="panel-box"><h3>Service status</h3>
          <dl className="kv"><dt>GitHub App</dt><dd>{me?.configured ? "configured" : "not configured on this server"}</dd>
            <dt>Your session</dt><dd>signed in as {me?.user?.login}</dd>
            <dt>Security issue</dt><dd><a href={`${REPO_URL}/security/advisories/new`}>Report privately</a></dd></dl></div>
      </div>
    </>
  );
}
