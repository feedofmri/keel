import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, Loading } from "../../components/app/Empty";
import { DecisionTag } from "../../components/app/RunsList";
import { PageHead } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { MODEL_NAMES, repoPath } from "../../lib/format";

const fmt = (v: number | string | null | undefined, d = 3) => (v == null ? "–" : Number(v).toFixed(d));

export default function RunDetail() {
  const id = Number(useParams().id);
  useTitle(`Run ${id} · Keel`);
  const { data: r, error, reload } = useAsync(() => api.run(id), [id]);
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  if (error) return <><PageHead crumbs={<Link to="/app/runs">Runs</Link>} title={`Run ${id}`} /><Empty title="Run not found">{error}</Empty></>;
  if (!r) return <><PageHead crumbs={<Link to="/app/runs">Runs</Link>} title={`Run ${id}`} /><Loading /></>;

  const rep = r.report, cands = [...(rep.candidates || [])].sort((a, b) => a.score - b.score);
  const wrong = Boolean(r.labelled_wrong || r.reverted_at);
  const secs = r.started_at && r.finished_at ? (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000 : null;
  const feedback = async (w: boolean) => { setBusy(true); setMsg("");
    try { await api.feedback(id, w); setMsg(w ? "Marked as incorrect. The run now counts against this repository's risk budget." : "The incorrect mark has been cleared."); reload(); }
    catch (e) { setMsg((e as Error).message); }
    setBusy(false); };

  return (
    <>
      <PageHead crumbs={<><Link to="/app/runs">Runs</Link> / <Link to={repoPath(r.repo)}>{r.repo}</Link></>} title={(rep.failing_tests || [])[0] || `Run ${id}`}
        actions={r.pr_number && <a className="btn" href={`https://github.com/${r.repo}/pull/${r.pr_number}`} target="_blank" rel="noopener">PR #{r.pr_number} on GitHub</a>}>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <DecisionTag r={r} />
          <span className="muted" style={{ fontSize: 13 }}>run {id} · {r.trigger.replace("_", " ")} · commit {String(r.commit_sha).slice(0, 7)} · {r.finished_at ? new Date(r.finished_at).toLocaleString() : "running"}</span>
        </div>
      </PageHead>

      <div className="kpis k5">
        <div><div className="k">Risk score</div><div className="v">{fmt(r.selected_score)}</div><div className="s">selected candidate</div></div>
        <div><div className="k">Threshold λ̂</div><div className="v">{fmt(r.threshold)}</div><div className="s">α {rep.alpha != null ? Math.round(rep.alpha * 100) + "%" : "–"} · {(rep.method || "crc").toUpperCase()}</div></div>
        <div><div className="k">Candidates</div><div className="v">{r.n_candidates ?? "–"}</div><div className="s">{cands.filter(c => !c.gates.length).length} passed the gates</div></div>
        <div><div className="k">Model cost</div><div className="v">${fmt(r.cost_usd, 3)}</div><div className="s">this run</div></div>
        <div><div className="k">Duration</div><div className="v">{secs == null ? "–" : secs < 90 ? `${Math.round(secs)}s` : `${Math.round(secs / 60)}m`}</div><div className="s">on your runner</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 40 }}>
        <div className="panel-box">
          <h3>Why {r.decision === "AUTO-MERGE" ? "it auto-merged" : "it needs review"}</h3>
          {(rep.reasons || []).length ? <ul className="bullets">{rep.reasons!.map(x => <li key={x}>{x}</li>)}</ul> : <p className="p-small">No reasons were reported.</p>}
        </div>
        <div className="panel-box">
          <h3>Guarantee</h3>
          <p className="p-small">{rep.guarantee || "No calibration was available, so Keel did not auto-merge."}</p>
          {rep.n_calibration != null && <p className="p-small" style={{ marginTop: 8 }}>Calibration: {rep.n_calibration} held-out bugs. <Link to="/app/calibration">View calibration status →</Link></p>}
        </div>
      </div>

      <div className="section-h"><h2>Candidates</h2><span className="muted" style={{ fontSize: 13 }}>lowest risk first</span></div>
      {cands.length ? (
        <div className="table-scroll"><table className="data cand-table">
          <thead><tr><th>Candidate</th><th>Model</th><th className="num">Risk</th><th className="num">Failing tests</th><th className="num">Kept passing</th><th className="num">Adversarial</th><th className="num">Lines</th><th>Gates / top factors</th></tr></thead>
          <tbody>{cands.map(c => (
            <tr key={c.id}>
              <td className={c.selected ? "sel" : ""}>{c.id}{c.selected ? " ✓" : ""}</td>
              <td>{MODEL_NAMES[c.model] || c.model}</td>
              <td className="num">{c.score.toFixed(3)}</td>
              <td className="num">{c.tests_passed}/{c.tests_total}</td>
              <td className="num">{c.kept_passing}/{c.kept_total}</td>
              <td className="num">{c.attacks_passed}/{c.attacks_total}</td>
              <td className="num">{c.diff_lines}</td>
              <td>{c.gates.length ? <span style={{ color: "var(--wrong)", fontSize: 13 }}>{c.gates.join(", ").replace(/_/g, " ")}</span>
                : c.top_factors.map(([k, v]) => <span key={k} className={`factor ${v < 0 ? "neg" : "pos"}`} title={v < 0 ? "lowers risk" : "raises risk"}>{k.replace(/_/g, " ")}</span>)}</td>
            </tr>))}</tbody>
        </table></div>
      ) : <p className="muted">Candidate details were not reported for this run. They are reported by the current version of the Keel Action.</p>}

      <div className="section-h"><h2>Failing tests</h2></div>
      <ul className="bullets">{(rep.failing_tests || []).map(t => <li key={t}><code>{t}</code></li>)}</ul>

      {r.can_manage && r.decision === "AUTO-MERGE" && (
        <div className="panel-box" style={{ marginTop: 40 }}>
          <h3>Was this fix incorrect?</h3>
          <p className="p-small">A revert on GitHub is recorded automatically. The run can also be marked here; it is then counted against this repository's risk budget and used for recalibration.</p>
          <div className="row-actions">
            {wrong && !r.reverted_at ? <button className="btn" disabled={busy} onClick={() => feedback(false)}>Clear the incorrect mark</button>
              : !wrong ? <button className="btn danger-btn" disabled={busy} onClick={() => feedback(true)}>Mark as incorrect</button>
              : <span className="muted" style={{ fontSize: 14 }}>This pull request was reverted on GitHub and is already counted as incorrect.</span>}
            {msg && <span className="ok-text">{msg}</span>}
          </div>
        </div>
      )}
    </>
  );
}
