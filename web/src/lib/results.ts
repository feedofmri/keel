import { useEffect, useState } from "react";
import { asset } from "./env";
import type { Point } from "./conformal";

export interface MethodRow { alpha: number; risk: number; risk_sd: number; fdr: number; merge: number; viol_risk: number; viol_fdr: number }
export interface Results {
  simulated: boolean; datasets: string[]; n_bugs: number; generators: string[];
  evaluation: { alphas: number[]; n_splits: number; delta: number; auroc: number | null; methods: Record<string, MethodRow[]> };
  slider: { cal: Point[]; test: Point[] };
  models: { models: string; solve_at_k: number; auroc: number | null; merge_rate: number; risk: number; cost_per_auto_merge: number | null }[];
  ablations: { removed: string; merge_rate: number; risk: number; auroc: number | null }[];
}

let cache: Promise<Results> | null = null;
export function loadResults(): Promise<Results> {
  return (cache ||= fetch(asset("data/results.json")).then(r => { if (!r.ok) throw new Error("results not found"); return r.json(); }));
}
export function useResults() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadResults().then(setData).catch(e => setError(String(e.message || e))); }, []);
  return { data, error };
}
