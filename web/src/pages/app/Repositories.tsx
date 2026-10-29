import { useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Loading } from "../../components/app/Empty";
import { PageHead } from "../../components/PageHead";
import { StatusPill } from "../../components/Pills";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { repoPath } from "../../lib/format";
import { useSession } from "../../lib/session";
import type { RepoStatus } from "../../lib/types";

const FILTERS: [string, string, (s: RepoStatus) => boolean][] = [
  ["all", "All", () => true], ["active", "Active", s => s === "active"], ["setup", "Setting up", s => s === "new" || s === "setup_pr_open"], ["paused", "Paused", s => s === "paused" || s === "error"],
];

export default function Repositories() {
  useTitle("Repositories · Keel");
  const { me } = useSession();
  const { data, error } = useAsync(() => api.repos(), []);
  const [q, setQ] = useState(""), [f, setF] = useState("all");
  const install = me?.installUrl || "#";
  const repos = data?.repos || [];
  const shown = repos.filter(r => FILTERS.find(x => x[0] === f)![2](r.status) && r.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Repositories" sub="Repositories accessible to the Keel GitHub App. Access is managed on GitHub."
        actions={<a className="btn primary" href={install} target="_blank" rel="noopener">Add repositories</a>} />
      {error ? <p className="err">{error}</p> : !data ? <Loading what="repositories" /> : !repos.length ? (
        <Empty title="Install the Keel GitHub App to get started" actions={<a className="btn primary" href={install}>Install Keel on GitHub</a>}>
          Select the repositories Keel may access. This selection can be changed on GitHub at any time.
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <div className="chips">{FILTERS.map(([k, label, fn]) => (
              <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{label}<span className="n">{repos.filter(r => fn(r.status)).length}</span></button>))}</div>
            <input className="search" type="search" placeholder="Filter repositories" value={q} onChange={e => setQ(e.target.value)} aria-label="Filter repositories" />
          </div>
          <div className="repo-list">{shown.map(r => {
            const isNew = r.status === "new";
            const to = isNew && r.canManage ? `${repoPath(r.full_name)}/settings` : repoPath(r.full_name);
            return (
              <div className="repo-row" key={r.full_name}>
                <div className="name"><Link to={to} style={{ textDecoration: "none" }}>{r.full_name}</Link><small>{r.private ? "Private" : "Public"}{r.language ? ` · ${r.language}` : ""}{r.canManage ? "" : " · read only"}</small></div>
                <div className="hide-sm"><StatusPill status={r.status} /></div>
                <div className="hide-sm muted" style={{ fontSize: 13 }}>{isNew ? "" : `α ${Math.round(r.alpha * 100)}%`}</div>
                <Link className={`btn${isNew && r.canManage ? " primary" : ""}`} to={to}>{isNew ? (r.canManage ? "Set up" : "View") : "Open"} <span className="arrow">→</span></Link>
              </div>
            );
          })}{!shown.length && <p className="empty">No repositories match.</p>}</div>
        </>
      )}
    </>
  );
}
