import type { RepoStatus, Run } from "../lib/types";

const STATUS: Record<RepoStatus, [string, string]> = {
  new: ["Not set up", "muted"], setup_pr_open: ["Setup PR open", "review"], active: ["Active", "auto"], paused: ["Paused", "muted"], error: ["Error", "review"],
};
export function StatusPill({ status }: { status: RepoStatus }) {
  const [t, c] = STATUS[status] || [status, "muted"];
  return <span className={`pill ${c}`}><span className="dot" />{t}</span>;
}
export function DecisionPill({ run, repo }: { run: Run; repo: string }) {
  const cls = run.decision === "AUTO-MERGE" ? "auto" : "review";
  if (!run.pr_number) return <span className="pill review"><span className="dot" />{run.decision || "no fix"}</span>;
  return <a className={`pill ${cls}`} style={{ textDecoration: "none" }} href={`https://github.com/${repo}/pull/${run.pr_number}`} target="_blank" rel="noopener">
    <span className="dot" />{run.decision} #{run.pr_number}</a>;
}
