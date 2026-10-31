import type {
  Account, ActivityEvent, CalibrationRow, CandidateSummary, Defaults, Detection, Installation, Me, Overview, RepoPayload,
  RepoStatus, RepoSummary, Run, RunDetail, RunFilter, RunRow, SavedKey, Usage,
} from "./types";

// Sample data for the demo build (GitHub Pages). Everything here is fictional and the UI labels it as a demo.
// Runs are generated from a fixed seed so every page tells the same story.
const KEY = "keel-demo-state";
interface DemoState {
  signedIn: boolean;
  statuses: Record<string, RepoStatus>;
  settings: Record<string, Partial<RepoPayload["repo"]>>;
  wrong: Record<number, boolean>;
  events: ActivityEvent[];
  defaults: Defaults;
  disconnected: string[];
  keys: SavedKey[];
}
const initial: DemoState = {
  signedIn: false,
  statuses: { "feedofmri/keel-demo": "active", "feedofmri/billing": "active", "feedofmri/shop-api": "setup_pr_open", "feedofmri/data-tools": "new" },
  settings: {}, wrong: {}, events: [], disconnected: [], keys: [],
  defaults: { alpha: 0.1, method: "crc", autoMerge: false, models: ["muse-spark", "muse-spark-open"] },
};
export function demoState(): DemoState {
  try { return { ...initial, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch { return { ...initial }; }
}
export function saveDemo(s: DemoState) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export function logDemo(action: string, repo: string | null, detail: Record<string, unknown> | null = null) {
  const s = demoState();
  s.events = [{ id: 1000 + s.events.length, action, repo, detail, at: new Date().toISOString(), actor: USER.login, avatar_url: USER.avatar_url }, ...s.events];
  saveDemo(s);
}

const USER = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4" };
export const demoMe = (): Me => ({ user: demoState().signedIn ? USER : null, configured: true, installUrl: "https://github.com/apps/keel-repair/installations/new" });

const REPOS: Omit<RepoSummary, "status">[] = [
  { full_name: "feedofmri/keel-demo", private: false, language: "Python", alpha: 0.1, canManage: true, installation: "feedofmri" },
  { full_name: "feedofmri/billing", private: true, language: "Python", alpha: 0.05, canManage: true, installation: "feedofmri" },
  { full_name: "feedofmri/shop-api", private: true, language: "Python", alpha: 0.1, canManage: true, installation: "feedofmri" },
  { full_name: "feedofmri/data-tools", private: false, language: "Python", alpha: 0.1, canManage: true, installation: "feedofmri" },
];
export const demoInstallations: Installation[] = [
  { id: 4101, account: "feedofmri", type: "User", repositorySelection: "selected", manageUrl: "https://github.com/settings/installations" },
];
export const demoRepos = (): RepoSummary[] => {
  const s = demoState();
  return REPOS.filter(r => !s.disconnected.includes(r.full_name)).map(r => ({ ...r, alpha: s.settings[r.full_name]?.alpha ?? r.alpha, status: s.statuses[r.full_name] }));
};
export const demoDetection: Detection = { language: "python", installCommand: "pip install -e . pytest", ciWorkflow: "CI",
  workflows: ["CI", "Release"], testCommand: "{python} -m pytest -q", notes: [] };

// ---- generated runs -------------------------------------------------------------------------------
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const TESTS: Record<string, string[]> = {
  "feedofmri/keel-demo": ["tests/test_pricing.py::test_ten_percent_discount", "tests/test_shipping.py::test_order_at_threshold_ships_free",
    "tests/test_cart.py::test_empty_cart", "tests/test_tax.py::test_vat_rounding", "tests/test_pricing.py::test_line_total"],
  "feedofmri/billing": ["tests/test_invoice.py::test_prorated_month", "tests/test_currency.py::test_round_half_even",
    "tests/test_refund.py::test_partial_refund", "tests/test_dunning.py::test_retry_schedule"],
};
const GOOD = ["passes 100% of the adversarial tests written by Muse Spark", "the other Meta model independently reached the same behaviour",
  "the change is small and targeted", "edits the code named in the failing traceback"];
const BAD = ["fails 50% of the adversarial tests written by Muse Spark", "behaves differently from most other candidates",
  "only 20% of other samples behave the same way", "adds a new static-analysis warning"];
const FACTORS = ["attack_survival", "cross_model_agreement", "consensus_score", "log_diff_size", "frac_files_in_traceback", "mean_logprob", "static_delta"];
const THR = 0.375, HOUR = 3600e3;

interface GenRun extends RunRow { report: RunDetail["report"] }
let cache: GenRun[] | null = null;
function generated(): GenRun[] {
  if (cache) return cache;
  const out: GenRun[] = [], now = Date.now();
  let id = 140;
  for (const [repo, n, seed] of [["feedofmri/keel-demo", 16, 7], ["feedofmri/billing", 11, 21]] as const) {
    const r = rng(seed), tests = TESTS[repo];
    for (let i = 0; i < n; i++) {
      const age = (i * 41 + r() * 30) * HOUR * (repo.endsWith("billing") ? 1.4 : 1) + 0.3 * HOUR;
      const hard = r() < 0.35;
      const cands: CandidateSummary[] = Array.from({ length: 10 }, (_, k) => {
        const s = Math.min(0.999, hard ? 0.3 + r() * 0.7 : Math.pow(r(), 3) * 0.6), att = 4 + Math.floor(r() * 3);
        return { id: `${k % 2 ? "muse-spark-open" : "muse-spark"}#${k >> 1}`, model: k % 2 ? "muse-spark-open" : "muse-spark", selected: false,
          applied: r() > 0.05, score: +s.toFixed(3), tests_passed: s < 0.9 ? 1 : 0, tests_total: 1, kept_passing: 12, kept_total: 12,
          attacks_passed: Math.round(att * (1 - s * 0.8)), attacks_total: att, diff_lines: 2 + Math.floor(r() * 14),
          gates: s > 0.95 ? ["failing_tests_still_fail"] : [], top_factors: FACTORS.slice(0, 3).map(f => [f, +((r() - 0.5) * s).toFixed(3)] as [string, number]),
          cost_usd: +(0.002 + r() * 0.004).toFixed(4) };
      });
      const best = cands.reduce((a, b) => (b.score < a.score ? b : a)); best.selected = true;
      const auto = best.score <= THR, finished = new Date(now - age).toISOString();
      const wrong = repo.endsWith("billing") && i === 6 && auto;
      out.push({
        id: id--, repo, trigger: ["workflow_run", "workflow_run", "issue_comment", "workflow_dispatch"][Math.floor(r() * 4)],
        commit_sha: Math.floor(r() * 0xfffffff).toString(16).padStart(7, "0"), started_at: new Date(now - age - 6 * 60e3).toISOString(),
        finished_at: finished, n_candidates: 10, selected_score: best.score, threshold: THR, decision: auto ? "AUTO-MERGE" : "NEEDS REVIEW",
        pr_number: 60 - i, cost_usd: +cands.reduce((s, c) => s + c.cost_usd, 0).toFixed(4), failing_tests: [tests[i % tests.length]],
        merged_at: auto || r() < 0.4 ? new Date(now - age + HOUR).toISOString() : null, reverted_at: wrong ? new Date(now - age + 20 * HOUR).toISOString() : null,
        labelled_wrong: wrong || null,
        report: { failing_tests: [tests[i % tests.length]], reasons: auto ? GOOD.slice(0, 2 + (i % 2)) : BAD.slice(i % 2, 2 + (i % 2)),
          alpha: repo.endsWith("billing") ? 0.05 : 0.1, method: "crc", n_calibration: 105,
          guarantee: "Calibrated on 105 held-out bugs: on average no more than 10% of bugs receive an incorrect automatic merge (conformal risk control).", candidates: cands },
      });
    }
  }
  return (cache = out.sort((a, b) => b.id - a.id));
}
function runs(): GenRun[] {
  const s = demoState();
  return generated().filter(r => !s.disconnected.includes(r.repo) && (s.statuses[r.repo] === "active" || s.statuses[r.repo] === "paused"))
    .map(r => (r.id in s.wrong ? { ...r, labelled_wrong: s.wrong[r.id] } : r));
}
const strip = ({ report: _r, ...row }: GenRun): RunRow => row;
const isWrong = (r: RunRow) => r.decision === "AUTO-MERGE" && Boolean(r.labelled_wrong || r.reverted_at);

export function demoRuns(f: RunFilter): { runs: RunRow[]; next: number | null } {
  let rs = runs();
  if (f.repo) rs = rs.filter(r => r.repo.toLowerCase() === f.repo!.toLowerCase());
  if (f.decision) rs = rs.filter(r => r.decision === (f.decision === "auto" ? "AUTO-MERGE" : "NEEDS REVIEW"));
  if (f.outcome === "wrong") rs = rs.filter(r => r.labelled_wrong || r.reverted_at);
  if (f.outcome === "merged") rs = rs.filter(r => r.merged_at);
  if (f.outcome === "open") rs = rs.filter(r => !r.merged_at && r.pr_number);
  if (f.before) rs = rs.filter(r => r.id < f.before!);
  const page = rs.slice(0, 20);
  return { runs: page.map(strip), next: rs.length > 20 ? page[page.length - 1].id : null };
}
export function demoRun(id: number): RunDetail | null {
  const r = runs().find(x => x.id === id);
  return r ? { ...r, can_manage: true } : null;
}
export function demoFeedback(id: number, wrong: boolean) {
  const s = demoState(); s.wrong[id] = wrong; saveDemo(s);
  logDemo(wrong ? "marked_wrong" : "unmarked_wrong", runs().find(r => r.id === id)?.repo ?? null, { run: id });
}

export function demoOverview(): Overview {
  const rs = runs(), month = rs.filter(r => Date.now() - new Date(r.finished_at!).getTime() < 30 * 24 * HOUR), repos = demoRepos();
  return {
    totals: { repos: repos.length, active: repos.filter(r => r.status === "active").length, pending: repos.filter(r => r.status === "new" || r.status === "setup_pr_open").length,
      runs: month.length, auto_merged: month.filter(r => r.decision === "AUTO-MERGE").length, review: month.filter(r => r.decision === "NEEDS REVIEW").length,
      wrong: month.filter(isWrong).length, cost: month.reduce((s, r) => s + Number(r.cost_usd), 0) },
    recent: rs.slice(0, 8).map(strip),
    queue: rs.filter(r => r.decision === "NEEDS REVIEW" && !r.merged_at).slice(0, 5).map(strip),
    setup: repos.filter(r => r.status === "new" || r.status === "setup_pr_open").map(r => ({ full_name: r.full_name, status: r.status, can_manage: r.canManage })),
  };
}

export function demoUsage(days: number): Usage {
  const rs = runs(), start = new Date(); start.setHours(0, 0, 0, 0);
  const daily = Array.from({ length: days }, (_, i) => {
    const d0 = start.getTime() - (days - 1 - i) * 24 * HOUR, inDay = rs.filter(r => { const t = new Date(r.finished_at!).getTime(); return t >= d0 && t < d0 + 24 * HOUR; });
    return { day: new Date(d0).toISOString().slice(0, 10), runs: inDay.length, cost: inDay.reduce((s, r) => s + Number(r.cost_usd), 0),
             auto_merged: inDay.filter(r => r.decision === "AUTO-MERGE").length };
  });
  const recent = rs.filter(r => Date.now() - new Date(r.finished_at!).getTime() < days * 24 * HOUR);
  const byRepo = [...new Set(recent.map(r => r.repo))].map(repo => { const x = recent.filter(r => r.repo === repo);
    return { repo, runs: x.length, cost: x.reduce((s, r) => s + Number(r.cost_usd), 0), auto_merged: x.filter(r => r.decision === "AUTO-MERGE").length }; })
    .sort((a, b) => b.cost - a.cost);
  const cands = recent.flatMap(r => r.report.candidates || []);
  const byModel = [...new Set(cands.map(c => c.model))].map(model => { const x = cands.filter(c => c.model === model);
    return { model, candidates: x.length, cost: x.reduce((s, c) => s + c.cost_usd, 0), selected: x.filter(c => c.selected).length }; })
    .sort((a, b) => b.cost - a.cost);
  return { days, daily, byRepo, byModel };
}

export function demoCalibration(): CalibrationRow[] {
  const rs = runs();
  return demoRepos().filter(r => r.status !== "new").map(r => {
    const x = rs.filter(y => y.repo === r.full_name), st = demoState().settings[r.full_name];
    return { repo: r.full_name, status: r.status, alpha: st?.alpha ?? r.alpha, method: (st?.method as "crc" | "ltt") ?? "crc", calibration_ref: "shared-v1",
      runs: x.length, auto_merged: x.filter(y => y.decision === "AUTO-MERGE").length, wrong: x.filter(isWrong).length,
      n_calibration: x.length ? "105" : null, guarantee: x[0]?.report.guarantee ?? null };
  });
}

export function demoActivity(repo?: string): ActivityEvent[] {
  const now = Date.now(), base: ActivityEvent[] = [
    { id: 9, action: "setup_pr", repo: "feedofmri/shop-api", detail: { pr: 2, secrets: ["KEEL_MUSE_SPARK_API_KEY", "KEEL_SPARK_OPEN_API_KEY"] }, at: new Date(now - 20 * HOUR).toISOString(), actor: USER.login, avatar_url: USER.avatar_url },
    { id: 8, action: "fix_now", repo: "feedofmri/keel-demo", detail: null, at: new Date(now - 30 * HOUR).toISOString(), actor: USER.login, avatar_url: USER.avatar_url },
    { id: 7, action: "marked_wrong", repo: "feedofmri/billing", detail: { run: 129 }, at: new Date(now - 4 * 24 * HOUR).toISOString(), actor: "mona", avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4" },
    { id: 6, action: "resume", repo: "feedofmri/keel-demo", detail: null, at: new Date(now - 9 * 24 * HOUR).toISOString(), actor: USER.login, avatar_url: USER.avatar_url },
    { id: 5, action: "pause", repo: "feedofmri/keel-demo", detail: null, at: new Date(now - 9.5 * 24 * HOUR).toISOString(), actor: USER.login, avatar_url: USER.avatar_url },
    { id: 4, action: "setup_pr", repo: "feedofmri/billing", detail: { pr: 1, secrets: ["KEEL_MUSE_SPARK_API_KEY"] }, at: new Date(now - 24 * 24 * HOUR).toISOString(), actor: "mona", avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4" },
    { id: 3, action: "setup_pr", repo: "feedofmri/keel-demo", detail: { pr: 1, secrets: ["KEEL_MUSE_SPARK_API_KEY", "KEEL_SPARK_OPEN_API_KEY"] }, at: new Date(now - 28 * 24 * HOUR).toISOString(), actor: USER.login, avatar_url: USER.avatar_url },
  ];
  const all = [...demoState().events, ...base];
  return repo ? all.filter(e => e.repo?.toLowerCase() === repo.toLowerCase()) : all;
}

export function demoAccount(): Account {
  return { user: { ...USER, created_at: new Date(Date.now() - 28 * 24 * HOUR).toISOString() },
    sessions: [{ id: "3f9a1c0b7e", created_at: new Date(Date.now() - 2 * HOUR).toISOString(), expires_at: new Date(Date.now() + 28 * 24 * HOUR).toISOString(), current: true },
               { id: "a81d44e2c9", created_at: new Date(Date.now() - 6 * 24 * HOUR).toISOString(), expires_at: new Date(Date.now() + 24 * 24 * HOUR).toISOString(), current: false }] };
}

export function demoRepo(full: string): RepoPayload {
  const st = demoState(), rs = runs().filter(r => r.repo.toLowerCase() === full.toLowerCase());
  const base = REPOS.find(r => r.full_name === full);
  const asRun = (r: GenRun): Run => ({ ...strip(r), report: { failing_tests: r.report.failing_tests, reasons: r.report.reasons } });
  const status = st.statuses[full] || "new", active = status === "active" || status === "paused";
  const repo = { full_name: full, status, alpha: base?.alpha ?? 0.1, method: "crc" as const, autoMerge: false,
    models: ["muse-spark", "muse-spark-open"], ciWorkflow: "CI", setupPr: 2, activatedAt: active ? new Date(Date.now() - 28 * 24 * HOUR).toISOString() : null,
    canManage: true, ...st.settings[full] };
  return { repo, runs: rs.map(asRun), stats: { runs: rs.length, autoMerged: rs.filter(r => r.decision === "AUTO-MERGE").length,
    wrong: rs.filter(isWrong).length, cost: rs.reduce((s, r) => s + Number(r.cost_usd), 0) } };
}
