import type { Detection, Me, RepoPayload, RepoSummary, Run } from "./types";

// Sample data for the demo build. Everything here is fictional and labelled as a demo in the UI.
const KEY = "keel-demo-state";
interface DemoState { signedIn: boolean; statuses: Record<string, RepoSummary["status"]>; settings: Record<string, Partial<RepoPayload["repo"]>> }
const initial: DemoState = { signedIn: false, statuses: { "feedofmri/keel-demo": "active", "feedofmri/shop-api": "setup_pr_open", "feedofmri/data-tools": "new" }, settings: {} };

export function demoState(): DemoState {
  try { return { ...initial, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch { return { ...initial }; }
}
export function saveDemo(s: DemoState) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

const USER = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4" };
export const demoMe = (): Me => ({ user: demoState().signedIn ? USER : null, configured: true,
  installUrl: "https://github.com/apps/keel-ai/installations/new" });

export const demoRepos = (): RepoSummary[] => {
  const s = demoState().statuses;
  return [
    { full_name: "feedofmri/keel-demo", private: false, language: "Python", status: s["feedofmri/keel-demo"], alpha: 0.1, canManage: true },
    { full_name: "feedofmri/shop-api", private: true, language: "Python", status: s["feedofmri/shop-api"], alpha: 0.1, canManage: true },
    { full_name: "feedofmri/data-tools", private: false, language: "Python", status: s["feedofmri/data-tools"], alpha: 0.1, canManage: true },
  ];
};

export const demoDetection: Detection = { language: "python", installCommand: "pip install -e . pytest", ciWorkflow: "CI",
  workflows: ["CI", "Release"], testCommand: "{python} -m pytest -q", notes: [] };

export function demoRepo(full: string): RepoPayload {
  const now = Date.now(), h = 3600e3, st = demoState();
  const active = st.statuses[full] === "active" || st.statuses[full] === "paused";
  const runs: Run[] = !active ? [] : [
    { id: 6, trigger: "workflow_run", commit_sha: "9f2c1ab", finished_at: new Date(now - 0.4 * h).toISOString(), n_candidates: 10, selected_score: 0.001, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 41, cost_usd: 0.031, report: { failing_tests: ["tests/test_pricing.py::test_ten_percent_discount"], reasons: ["passes 100% of the adversarial tests written by Muse Spark", "the other Meta model independently reached the same behaviour"] }, merged_at: new Date(now - 0.3 * h).toISOString() },
    { id: 5, trigger: "issue_comment", commit_sha: "51d0e7c", finished_at: new Date(now - 5 * h).toISOString(), n_candidates: 10, selected_score: 0.939, threshold: 0.375, decision: "NEEDS REVIEW", pr_number: 39, cost_usd: 0.044, report: { failing_tests: ["tests/test_shipping.py::test_order_at_threshold_ships_free"], reasons: ["fails 50% of the adversarial tests written by Muse Spark", "behaves differently from most other candidates"] } },
    { id: 4, trigger: "workflow_run", commit_sha: "c77a210", finished_at: new Date(now - 26 * h).toISOString(), n_candidates: 10, selected_score: 0.012, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 36, cost_usd: 0.029, report: { failing_tests: ["tests/test_cart.py::test_empty_cart"], reasons: ["the change is small and targeted"] }, merged_at: new Date(now - 25 * h).toISOString() },
    { id: 3, trigger: "workflow_run", commit_sha: "0be4d19", finished_at: new Date(now - 50 * h).toISOString(), n_candidates: 10, selected_score: 0.61, threshold: 0.375, decision: "NEEDS REVIEW", pr_number: 33, cost_usd: 0.052, report: { failing_tests: ["tests/test_tax.py::test_vat_rounding"], reasons: ["only 20% of other samples behave the same way"] } },
    { id: 2, trigger: "workflow_dispatch", commit_sha: "7aa91f3", finished_at: new Date(now - 74 * h).toISOString(), n_candidates: 10, selected_score: 0.004, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 30, cost_usd: 0.027, report: { failing_tests: ["tests/test_pricing.py::test_line_total"], reasons: ["edits the code named in the failing traceback"] }, merged_at: new Date(now - 73 * h).toISOString() },
  ];
  const repo = { full_name: full, status: st.statuses[full] || "new", alpha: 0.1, method: "crc" as const, autoMerge: false,
                 models: ["muse-spark", "muse-spark-open"], ciWorkflow: "CI", setupPr: 2, activatedAt: active ? new Date(now - 80 * h).toISOString() : null,
                 canManage: true, ...st.settings[full] };
  const merged = runs.filter(r => r.decision === "AUTO-MERGE").length;
  return { repo, stats: { runs: runs.length, autoMerged: merged, wrong: 0, cost: runs.reduce((s, r) => s + Number(r.cost_usd), 0) }, runs };
}
