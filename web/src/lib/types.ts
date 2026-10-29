export interface User { login: string; avatar_url: string | null }
export interface Me { user: User | null; configured: boolean; installUrl: string }
export type RepoStatus = "new" | "setup_pr_open" | "active" | "paused" | "error";
export interface RepoSummary { full_name: string; private: boolean; language: string | null; status: RepoStatus; alpha: number; canManage: boolean; installation?: string }
export interface RepoDetail {
  full_name: string; status: RepoStatus; alpha: number; method: "crc" | "ltt"; autoMerge: boolean; models: string[];
  ciWorkflow: string | null; setupPr: number | null; activatedAt: string | null; canManage: boolean;
}
export interface Run {
  id: number; trigger: string; commit_sha: string; finished_at: string | null; n_candidates: number | null;
  selected_score: number | null; threshold: number | null; decision: "AUTO-MERGE" | "NEEDS REVIEW" | null; pr_number: number | null;
  cost_usd: number | string | null; report: { failing_tests?: string[]; reasons?: string[] };
  merged_at?: string | null; reverted_at?: string | null; labelled_wrong?: boolean | null;
}
export interface RepoPayload { repo: RepoDetail; stats: { runs: number; autoMerged: number; wrong: number; cost: number }; runs: Run[] }
export interface Detection { language: string; installCommand: string; ciWorkflow: string | null; workflows: string[]; testCommand: string; notes: string[] }
export interface SetupSettings { alpha: number; method: "crc" | "ltt"; autoMerge: boolean; models: string[]; ciWorkflow: string | null;
  installCommand: string; secrets: Record<string, string> }

// Cross-repository pages
export interface RunRow {
  id: number; repo: string; trigger: string; commit_sha: string; started_at: string | null; finished_at: string | null;
  n_candidates: number | null; selected_score: number | null; threshold: number | null; decision: "AUTO-MERGE" | "NEEDS REVIEW" | null;
  pr_number: number | null; cost_usd: number | string | null; failing_tests: string[] | null;
  merged_at: string | null; reverted_at: string | null; labelled_wrong: boolean | null;
}
export interface CandidateSummary {
  id: string; model: string; selected: boolean; applied: boolean; score: number; tests_passed: number; tests_total: number;
  kept_passing: number; kept_total: number; attacks_passed: number; attacks_total: number; diff_lines: number;
  gates: string[]; top_factors: [string, number][]; cost_usd: number;
}
export interface RunDetail extends RunRow {
  can_manage: boolean;
  report: { failing_tests?: string[]; reasons?: string[]; alpha?: number; method?: string; guarantee?: string; n_calibration?: number; candidates?: CandidateSummary[] };
}
export interface RunFilter { repo?: string; decision?: "auto" | "review"; outcome?: "wrong" | "merged" | "open"; before?: number }
export interface Overview {
  totals: { repos: number; active: number; pending: number; runs: number; auto_merged: number; review: number; wrong: number; cost: number };
  recent: RunRow[]; queue: RunRow[]; setup: { full_name: string; status: RepoStatus; can_manage: boolean }[];
}
export interface Usage {
  days: number; daily: { day: string; runs: number; cost: number; auto_merged: number }[];
  byRepo: { repo: string; runs: number; cost: number; auto_merged: number }[];
  byModel: { model: string; candidates: number; cost: number; selected: number }[];
}
export interface CalibrationRow {
  repo: string; status: RepoStatus; alpha: number; method: "crc" | "ltt"; calibration_ref: string; runs: number;
  auto_merged: number; wrong: number; n_calibration: string | null; guarantee: string | null;
}
export interface ActivityEvent { id: number; action: string; detail: Record<string, unknown> | null; at: string; actor: string | null; avatar_url: string | null; repo: string | null }
export interface Defaults { alpha: number; method: "crc" | "ltt"; autoMerge: boolean; models: string[] }
export interface Account { user: { login: string; avatar_url: string | null; created_at: string }; sessions: { id: string; created_at: string; expires_at: string; current: boolean }[] }
export interface Installation { id: number; account: string; type: string; repositorySelection: string; manageUrl: string }
