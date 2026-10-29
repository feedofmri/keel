// Mirrors keel/conformal.py so the browser can recompute thresholds for any risk level.
export type Point = [number, number, ...number[]]; // [score, wrong, gated?, ...]
export const NEVER = -1, GATED = 1;

export function crcThreshold(cal: Point[], alpha: number): number {
  const n = cal.length; if (!n || 1 / (n + 1) > alpha) return NEVER;
  const pairs = cal.filter(p => p[0] < GATED).sort((a, b) => a[0] - b[0]);
  let loss = 0, best = NEVER, i = 0;
  while (i < pairs.length) {
    const s = pairs[i][0];
    while (i < pairs.length && pairs[i][0] === s) { loss += pairs[i][1]; i++; }
    if ((loss + 1) / (n + 1) <= alpha) best = s; else break;
  }
  return best;
}

function lgamma(x: number): number {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function binomP(w: number, k: number, p: number): number {
  if (k === 0 || w >= k) return 1;
  const terms: number[] = [];
  for (let i = 0; i <= w; i++) terms.push(lgamma(k + 1) - lgamma(i + 1) - lgamma(k - i + 1) + i * Math.log(p) + (k - i) * Math.log1p(-p));
  const m = Math.max(...terms); return Math.exp(m + Math.log(terms.reduce((s, t) => s + Math.exp(t - m), 0)));
}
export const LTT_GRID = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export function stats(points: Point[], thr: number) {
  let k = 0, w = 0;
  for (const p of points) if (p[0] <= thr && p[0] < GATED) { k++; if (p[1]) w++; }
  const n = points.length;
  return { k, w, n, merge: n ? k / n : 0, risk: n ? w / n : 0, fdr: k ? w / k : 0 };
}
export function lttThreshold(cal: Point[], alpha: number, delta: number): number {
  let best = NEVER; const level = delta / LTT_GRID.length;
  for (const lam of LTT_GRID) { const s = stats(cal, lam); if (binomP(s.w, s.k, alpha) <= level) best = Math.max(best, lam); }
  return best;
}
export const pct = (x: number, d = 0) => (100 * x).toFixed(d) + "%";
