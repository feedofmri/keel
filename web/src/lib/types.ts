export interface User { login: string; avatar_url: string | null }
export interface Me { user: User | null; configured: boolean; installUrl: string }
export type RepoStatus = "new" | "setup_pr_open" | "active" | "paused" | "error";
export interface RepoSummary { full_name: string; private: boolean; language: string | null; status: RepoStatus; alpha: number; canManage: boolean }
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
