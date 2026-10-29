import { Link } from "react-router-dom";
import { PageHead } from "../../components/PageHead";
import { useTitle } from "../../hooks/useTitle";
import { REPO_URL } from "../../lib/env";
import { useSession } from "../../lib/session";

const LINKS = [
  { to: "/docs", title: "Quickstart", text: "Connect a repository and receive the first labelled fix." },
  { to: "/docs/configuration", title: "Configuration", text: "Reference for every .keel.toml key and its default." },
  { to: "/docs/github-action", title: "GitHub Action", text: "Inputs, triggers and permissions." },
  { to: "/docs/calibration", title: "Calibration", text: "Building and maintaining a calibration." },
  { to: "/guarantee", title: "The guarantee", text: "What the risk level α guarantees, and its assumptions." },
  { to: "/docs/faq", title: "FAQ", text: "Answers to frequently asked questions." },
];

export default function Help() {
  useTitle("Help · Keel");
  const { me } = useSession();
  return (
    <>
      <PageHead title="Help" sub="Documentation, frequently asked questions and support." />
      <div className="next-grid" style={{ marginTop: 0 }}>
        {LINKS.map(l => <Link key={l.to} to={l.to} className="next-card"><h4>{l.title} <span className="arrow">→</span></h4><p className="p-small">{l.text}</p></Link>)}
      </div>
      <div className="grid2" style={{ marginTop: 40 }}>
        <div className="panel-box"><h3>Reporting a problem</h3>
          <p className="p-small">Open an issue that includes the run ID (shown on every run page) and the expected behaviour. Do not include API keys.</p>
          <div className="row-actions"><a className="btn" href={`${REPO_URL}/issues/new`}>Open an issue</a></div></div>
        <div className="panel-box"><h3>Service status</h3>
          <dl className="kv"><dt>GitHub App</dt><dd>{me?.configured ? "configured" : "not configured on this server"}</dd>
            <dt>Your session</dt><dd>signed in as {me?.user?.login}</dd>
            <dt>Security issue</dt><dd><a href={`${REPO_URL}/security/advisories/new`}>Report privately</a></dd></dl></div>
      </div>
    </>
  );
}
