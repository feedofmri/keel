import { Link } from "react-router-dom";
import { ago } from "../../lib/format";
import type { RunRow } from "../../lib/types";

export function DecisionTag({ r }: { r: RunRow }) {
  const wrong = r.decision === "AUTO-MERGE" && (r.labelled_wrong || r.reverted_at);
  if (wrong) return <span className="pill review" style={{ color: "var(--wrong)" }}><span className="dot" style={{ background: "var(--wrong)" }} />INCORRECT</span>;
  return <span className={`pill ${r.decision === "AUTO-MERGE" ? "auto" : "review"}`}><span className="dot" />{r.decision || "NO FIX"}</span>;
}

/** Runs as rows; each row opens the run's page. */
export function RunsList({ runs, showRepo = true }: { runs: RunRow[]; showRepo?: boolean }) {
  return (
    <div className={`list runs-list${showRepo ? " with-repo" : ""}`}>
      {runs.map(r => {
        const tests = r.failing_tests || [];
        return (
          <Link className="list-row" key={r.id} to={`/app/runs/${r.id}`}>
            <span className="when hide-md2">{ago(r.finished_at)}</span>
            <span className="t">{tests[0] || "repair run"}{tests.length > 1 ? ` +${tests.length - 1}` : ""}
              <small>{r.trigger.replace("_", " ")} · {String(r.commit_sha).slice(0, 7)}{r.pr_number ? ` · PR #${r.pr_number}` : ""}{r.merged_at ? " · merged" : ""}{r.reverted_at ? " · reverted" : ""}</small></span>
            {showRepo && <span className="repo hide-md2">{r.repo}</span>}
            <span className="mono-s hide-md2">risk {r.selected_score == null ? "–" : Number(r.selected_score).toFixed(3)} · threshold {r.threshold == null ? "–" : Number(r.threshold).toFixed(3)}</span>
            <DecisionTag r={r} />
          </Link>
        );
      })}
    </div>
  );
}
