import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { PageHead, RepoCrumbs, RepoTabs } from "../../components/PageHead";
import { StatusPill } from "../../components/Pills";
import { RunsList } from "../../components/app/RunsList";
import { useAsync } from "../../hooks/useAsync";
import { useRepoName } from "../../hooks/useRepoName";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { DEMO } from "../../lib/env";
import { repoPath } from "../../lib/format";

export default function RepoOverview() {
  const full = useRepoName();
  useTitle(`${full} · Keel`);
  const { data, error, reload } = useAsync(() => api.repo(full), [full]);
  const recent = useAsync(() => api.runs({ repo: full }), [full]);
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState<"" | "fix" | "toggle">("");

  // Shared hosting can't hold WebSockets open, so poll while the tab is visible.
  useEffect(() => {
    if (DEMO) return;
    const t = setInterval(() => { if (!document.hidden) reload(); }, 10000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) return <><PageHead crumbs={<RepoCrumbs full={full} />} title={full} /><p className="err">{error}</p></>;
  if (!data) return <><PageHead crumbs={<RepoCrumbs full={full} />} title={full} /><p className="muted">Loading…</p></>;
  const { repo: r, stats: s } = data;
  if (r.status === "new" && r.canManage) return <Navigate replace to={`${repoPath(full)}/settings`} />;

  const paused = r.status === "paused";
  const budget = s.autoMerged ? s.wrong / s.autoMerged : 0;
  const act = async (kind: "fix" | "toggle") => {
    setBusy(kind);
    try {
      if (kind === "fix") { await api.action(full, "fix"); setFlash("Keel run started on GitHub Actions. It appears here when it finishes."); }
      else { await api.action(full, paused ? "resume" : "pause"); setFlash(paused ? "Resumed." : "Paused. Keel won't run until you resume."); }
    } catch (e) { setFlash((e as Error).message); }
    setBusy(""); reload(); recent.reload();
  };

  return (
    <>
      <PageHead crumbs={<RepoCrumbs full={full} />} title={r.full_name}
        actions={r.canManage && <>
          <button className="btn primary" disabled={!!busy || paused} onClick={() => act("fix")}>{busy === "fix" ? "Starting…" : "Fix now"}</button>
          <button className="btn" disabled={!!busy} onClick={() => act("toggle")}>{paused ? "Resume" : "Pause"}</button>
        </>}>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill status={r.status} />
          <span className="muted" style={{ fontSize: 13 }}>α {Math.round(r.alpha * 100)}% · {r.method.toUpperCase()} · {r.autoMerge ? "auto-merge" : "label only"} · {r.models.join(" + ")}</span>
          {r.status === "active" && <span className="live">live</span>}
        </div>
      </PageHead>
      <RepoTabs full={full} canManage={r.canManage} />
      {flash && <div className="banner" style={{ marginBottom: 28 }}>{flash}</div>}
      {r.status === "setup_pr_open" && <div className="banner" style={{ marginBottom: 28 }}>Waiting for setup PR #{r.setupPr} to be merged. Keel goes live as soon as it is.</div>}

      <div className="kpis">
        <div><div className="k">Runs</div><div className="v">{s.runs}</div><div className="s">last 50</div></div>
        <div><div className="k">Auto-merged</div><div className="v">{s.autoMerged}</div><div className="s">{s.runs ? Math.round(100 * s.autoMerged / s.runs) : 0}% of runs</div></div>
        <div><div className="k">Wrong merges</div><div className="v">{s.wrong}</div><div className="s">reverted or flagged</div></div>
        <div><div className="k">Model cost</div><div className="v">${s.cost.toFixed(2)}</div><div className="s">all runs</div></div>
      </div>
      <div className="budget">
        <div><h3 className="h-panel">Risk budget</h3><p className="p-small" style={{ marginTop: 6 }}>Observed wrong share of auto-merges against your α of {Math.round(r.alpha * 100)}%.</p></div>
        <div><div className="gauge"><div className="fill" style={{ width: `${Math.min(100, (budget / r.alpha) * 100)}%` }} /></div>
          <div className="gauge-labels"><span>{Math.round(budget * 100)}% used</span><span>budget α = {Math.round(r.alpha * 100)}%</span></div></div>
      </div>

      <div className="section-h"><h2>Recent runs</h2><Link to={`${repoPath(full)}/runs`}>All runs →</Link></div>
      {recent.data == null ? <p className="muted">Loading…</p> : recent.data.runs.length ? <RunsList runs={recent.data.runs.slice(0, 6)} showRepo={false} />
        : <p className="empty">No runs yet. Keel runs when CI fails, on <code>/keel fix</code>, or when you press Fix now.</p>}
    </>
  );
}
