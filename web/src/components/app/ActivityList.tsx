import { Link } from "react-router-dom";
import { ago, repoPath } from "../../lib/format";
import type { ActivityEvent } from "../../lib/types";

function describe(e: ActivityEvent) {
  const d = (e.detail || {}) as Record<string, any>;
  const repo = e.repo ? <Link to={repoPath(e.repo)}>{e.repo}</Link> : <span>{String(d.repo || "a repository")}</span>;
  switch (e.action) {
    case "setup_pr": return <>opened setup PR #{d.pr} on {repo}{d.secrets?.length ? ` and stored ${d.secrets.length} secret(s)` : ""}</>;
    case "fix_now": return <>started a run on {repo}</>;
    case "pause": return <>paused Keel on {repo}</>;
    case "resume": return <>resumed Keel on {repo}</>;
    case "marked_wrong": return <>marked <Link to={`/app/runs/${d.run}`}>run {d.run}</Link> on {repo} as wrong</>;
    case "unmarked_wrong": return <>cleared the wrong mark on <Link to={`/app/runs/${d.run}`}>run {d.run}</Link></>;
    case "disconnect": return <>disconnected {repo} from Keel</>;
    default: return <>{e.action.replace(/_/g, " ")} {repo}</>;
  }
}

export function ActivityList({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="list act-list">
      {events.map(e => (
        <div className="list-row" key={e.id}>
          {e.avatar_url ? <img src={e.avatar_url} alt="" width={24} height={24} /> : <span className="ava" />}
          <span className="t"><b>{e.actor || "deleted user"}</b> {describe(e)}</span>
          <span className="when" title={new Date(e.at).toLocaleString()}>{ago(e.at)}</span>
        </div>
      ))}
    </div>
  );
}
