import { Link } from "react-router-dom";
import { Empty, Loading } from "../../components/app/Empty";
import { PageHead } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { pct } from "../../lib/conformal";
import { repoPath } from "../../lib/format";
import { useResults } from "../../lib/results";

export default function Calibration() {
  useTitle("Calibration · Keel");
  const { data, error } = useAsync(() => api.calibration(), []);
  const { data: shared } = useResults();
  return (
    <>
      <PageHead title="Calibration" sub="The observed rate of incorrect automatic merges in each repository, compared with its configured risk level." />
      <div className="grid2">
        <div className="panel-box">
          <h3>Shared calibration · shared-v1</h3>
          <p className="p-small">{shared ? (shared.simulated ? <>{shared.slider.cal.length} calibration bugs of simulated preview data, until the QuixBugs and SWE-bench Lite runs finish.</>
            : <>{shared.slider.cal.length} calibration bugs from {shared.datasets.join(" + ")}.</>) : "Loading…"}</p>
          <p className="p-small" style={{ marginTop: 8 }}>New repositories start here. Build your own from your history for a closer match. <Link to="/docs/calibration">How →</Link></p>
        </div>
        <div className="panel-box">
          <h3>How to read this</h3>
          <p className="p-small">Per bug (CRC): incorrect automatic merges divided by all runs should remain at or below α on average. Per merge (LTT): incorrect merges divided by automatic merges. Small samples vary considerably, so assess the rate after several dozen runs.</p>
        </div>
      </div>

      <div className="section-h"><h2>Repositories</h2></div>
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : !data.length ? (
        <Empty title="No connected repositories yet" actions={<Link className="btn primary" to="/app/repos">Set up a repository</Link>}>The observed error rate is shown once a repository has completed runs.</Empty>
      ) : (
        <div className="table-scroll"><table className="data">
          <thead><tr><th>Repository</th><th>Policy</th><th className="num">Runs</th><th className="num">Auto-merged</th><th className="num">Wrong</th><th>Observed vs α</th><th>Status</th></tr></thead>
          <tbody>{data.map(r => {
            const observed = r.method === "ltt" ? (r.auto_merged ? r.wrong / r.auto_merged : 0) : (r.runs ? r.wrong / r.runs : 0);
            const over = observed > r.alpha, few = r.runs < 20;
            return (
              <tr key={r.repo}>
                <td><Link to={repoPath(r.repo)}>{r.repo}</Link><div className="muted" style={{ fontSize: 12 }}>{r.calibration_ref}{r.n_calibration ? ` · n = ${r.n_calibration}` : ""}</div></td>
                <td>α {pct(r.alpha)} · {r.method.toUpperCase()}</td>
                <td className="num">{r.runs}</td><td className="num">{r.auto_merged}</td><td className="num">{r.wrong}</td>
                <td style={{ minWidth: 160 }}>{pct(observed, 1)} of {pct(r.alpha)}<div className={`share${over ? " over" : ""}`}><i style={{ width: `${Math.min(100, (observed / r.alpha) * 100)}%` }} /></div></td>
                <td>{!r.runs ? <span className="muted">no runs yet</span> : over ? <span style={{ color: "var(--wrong)" }}>{few ? "over, few runs" : "over budget"}</span> : <span className="ok-text">{few ? "within, few runs" : "within budget"}</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <p className="p-small" style={{ marginTop: 20 }}>A repository that remains over budget indicates that its bugs are not comparable to the calibration bugs. Lower α, switch to LTT, or recalibrate on its own history.</p>
    </>
  );
}
