import { Link } from "react-router-dom";
import { Empty, Loading } from "../../components/app/Empty";
import { RunsList } from "../../components/app/RunsList";
import { PageHead } from "../../components/PageHead";
import { StatusPill } from "../../components/Pills";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { repoPath } from "../../lib/format";
import { useSession } from "../../lib/session";

export default function Overview() {
  useTitle("Overview · Keel");
  const { me } = useSession();
  const { data, error } = useAsync(() => api.overview(), []);
  const t = data?.totals;
  return (
    <>
      <PageHead title={`Welcome back, ${me?.user?.login}`} sub="Everything Keel did across your repositories in the last 30 days."
        actions={<Link className="btn" to="/app/repos">Repositories</Link>} />
      {error ? <p className="err">{error}</p> : !data || !t ? <Loading /> : !t.repos ? (
        <Empty title="Connect your first repository" actions={<><a className="btn primary" href={me?.installUrl}>Install Keel on GitHub</a><Link className="btn" to="/docs">Read the quickstart</Link></>}>
          Install the Keel GitHub App on the repositories you choose. Setting one up takes about two minutes.
        </Empty>
      ) : (
        <>
          <div className="kpis k5">
            <div><div className="k">Runs</div><div className="v">{t.runs}</div><div className="s">last 30 days</div></div>
            <div><div className="k">Auto-merged</div><div className="v">{t.auto_merged}</div><div className="s">{t.runs ? Math.round(100 * t.auto_merged / t.runs) : 0}% of runs</div></div>
            <div><div className="k">Sent to review</div><div className="v">{t.review}</div><div className="s">with reasons</div></div>
            <div><div className="k">Wrong merges</div><div className="v">{t.wrong}</div><div className="s">reverted or marked</div></div>
            <div><div className="k">Model cost</div><div className="v">${t.cost.toFixed(2)}</div><div className="s">all repositories</div></div>
          </div>

          {data.setup.length > 0 && <>
            <div className="section-h"><h2>Finish setting up</h2></div>
            <div className="list">{data.setup.map(r => (
              <Link className="list-row setup-row" key={r.full_name} to={`${repoPath(r.full_name)}${r.status === "new" ? "/settings" : ""}`}>
                <span className="t">{r.full_name}<small>{r.status === "new" ? "Choose models and a risk level, then merge one pull request." : "Merge the setup pull request on GitHub to go live."}</small></span>
                <span className="hide-sm"><StatusPill status={r.status} /></span>
                <span className="btn">{r.status === "new" ? "Set up" : "Open"} <span className="arrow">→</span></span>
              </Link>))}</div>
          </>}

          <div className="section-h"><h2>Needs review</h2><Link to="/app/runs?decision=review">All →</Link></div>
          {data.queue.length ? <RunsList runs={data.queue} /> : <p className="muted">Nothing waiting. Fixes Keel couldn't vouch for show up here.</p>}

          <div className="section-h"><h2>Recent runs</h2><Link to="/app/runs">All runs →</Link></div>
          {data.recent.length ? <RunsList runs={data.recent} /> : <p className="muted">No runs yet. Keel runs when CI fails, on <code>/keel fix</code>, or when you press Fix now.</p>}
        </>
      )}
    </>
  );
}
