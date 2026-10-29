import { Link } from "react-router-dom";
import { PageHead } from "../../components/PageHead";
import { StatusPill } from "../../components/Pills";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { repoPath } from "../../lib/format";
import { useSession } from "../../lib/session";

export default function Repositories() {
  useTitle("Repositories · Keel");
  const { me } = useSession();
  const { data: repos, error } = useAsync(() => api.repos(), []);
  const install = me?.installUrl || "#";
  return (
    <>
      <PageHead crumbs={me?.user?.login} title="Repositories"
        actions={<a className="btn" href={install} target="_blank" rel="noopener">Add repositories on GitHub</a>} />
      {error ? <p className="err">{error}</p>
        : !repos ? <p className="muted">Loading repositories…</p>
        : !repos.length ? (
          <div className="empty"><h3 className="h-panel">Install the Keel GitHub App to get started</h3>
            <p className="p-small" style={{ marginTop: 8 }}>Choose the repositories Keel may work on. You can change this any time on GitHub.</p>
            <div className="ctas start"><a className="btn primary" href={install}>Install Keel on GitHub</a></div></div>
        ) : (
          <div className="repo-list">{repos.map(r => {
            const isNew = r.status === "new";
            const to = isNew && r.canManage ? `${repoPath(r.full_name)}/settings` : repoPath(r.full_name);
            return (
              <div className="repo-row" key={r.full_name}>
                <div className="name">{r.full_name}<small>{r.private ? "Private" : "Public"}{r.language ? ` · ${r.language}` : ""}</small></div>
                <div className="hide-sm"><StatusPill status={r.status} /></div>
                <div className="hide-sm muted" style={{ fontSize: 13 }}>{isNew ? "" : `α ${Math.round(r.alpha * 100)}%`}</div>
                <Link className={`btn${isNew && r.canManage ? " primary" : ""}`} to={to}>{isNew ? (r.canManage ? "Set up" : "View") : "Open"} <span className="arrow">→</span></Link>
              </div>
            );
          })}</div>
        )}
    </>
  );
}
