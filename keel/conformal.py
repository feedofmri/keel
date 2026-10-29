"""Distribution-free decision thresholds.

Decision rule: auto-merge a bug's selected patch iff its score s <= lambda.
Calibration data: n held-out bugs with score s_i and wrong_i in {0, 1} (from hidden tests).

Two guarantees are offered (both assume calibration and test bugs are exchangeable):

* CRC (conformal risk control, Angelopoulos et al. 2022): with loss
  L_i(lambda) = wrong_i * 1{s_i <= lambda} (monotone, bounded by 1), choosing
  lambda_hat = max{lambda : (sum_i L_i(lambda) + 1) / (n + 1) <= alpha}
  gives E[ 1{merged and wrong} ] <= alpha for a new bug: wrong auto-merges, as a share of
  ALL bugs, are at most alpha in expectation.

* LTT (Learn-then-Test, Angelopoulos et al. 2021): for each lambda on a fixed grid, test
  H0: P(wrong | s <= lambda) > alpha with an exact binomial p-value and Bonferroni
  correction. With probability >= 1 - delta over the calibration draw, the share of
  AUTO-MERGED patches that are wrong is at most alpha.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

NEVER = -1.0  # threshold that merges nothing (all scores are >= 0)
GATED = 1.0   # scores of gated patches; thresholds are always below this


@dataclass
class RuleStats:
    threshold: float
    merge_rate: float  # share of bugs auto-merged
    risk: float        # share of bugs wrongly auto-merged (CRC risk)
    fdr: float         # share of auto-merged patches that are wrong (0 if none merged)
    n_merged: int
    n_wrong_merged: int


def rule_stats(scores: list[float], wrong: list[bool], threshold: float) -> RuleStats:
    n = len(scores)
    merged = [s <= threshold and s < GATED for s in scores]
    k = sum(merged)
    w = sum(1 for m, bad in zip(merged, wrong) if m and bad)
    return RuleStats(threshold=threshold, merge_rate=k / n if n else 0.0, risk=w / n if n else 0.0,
                     fdr=w / k if k else 0.0, n_merged=k, n_wrong_merged=w)


def _candidates(scores: list[float]) -> list[float]:
    return sorted({s for s in scores if s < GATED})


def crc_threshold(scores: list[float], wrong: list[bool], alpha: float, bound: float = 1.0) -> float:
    """Largest threshold whose adjusted calibration risk is <= alpha (NEVER if none)."""
    n = len(scores)
    if n == 0:
        return NEVER
    pairs = sorted((s, bool(b)) for s, b in zip(scores, wrong) if s < GATED)
    best = NEVER
    if bound / (n + 1) > alpha:
        return NEVER
    loss = 0
    i = 0
    while i < len(pairs):
        s = pairs[i][0]
        # include all calibration points tied at s
        while i < len(pairs) and pairs[i][0] == s:
            loss += pairs[i][1]
            i += 1
        if (loss + bound) / (n + 1) <= alpha:
            best = s
        else:
            break  # loss is monotone in the threshold
    return best


def _log_binom_cdf(w: int, k: int, p: float) -> float:
    """log P(Bin(k, p) <= w)."""
    if w >= k:
        return 0.0
    if p <= 0:
        return 0.0
    if p >= 1:
        return -math.inf
    terms = [math.lgamma(k + 1) - math.lgamma(i + 1) - math.lgamma(k - i + 1)
             + i * math.log(p) + (k - i) * math.log1p(-p) for i in range(w + 1)]
    m = max(terms)
    return m + math.log(sum(math.exp(t - m) for t in terms))


def binom_pvalue(w: int, k: int, alpha: float) -> float:
    """p-value for H0: wrong-rate among k merged > alpha, having observed w wrong."""
    if k == 0:
        return 1.0
    return math.exp(_log_binom_cdf(w, k, alpha))


# Fixed in advance (never chosen from data). Coarse, and dense near 0 where good patches score,
# because the Bonferroni correction pays for every grid point.
LTT_GRID = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]


def ltt_threshold(scores: list[float], wrong: list[bool], alpha: float, delta: float = 0.1,
                  grid: list[float] | None = None) -> float:
    """Largest grid threshold certified to have FDR <= alpha w.p. >= 1 - delta (Bonferroni)."""
    grid = grid or LTT_GRID
    level = delta / len(grid)
    best = NEVER
    for lam in grid:
        st = rule_stats(scores, wrong, lam)
        if binom_pvalue(st.n_wrong_merged, st.n_merged, alpha) <= level:
            best = max(best, lam)
    return best


def threshold(method: str, scores: list[float], wrong: list[bool], alpha: float, delta: float = 0.1) -> float:
    if method == "crc":
        return crc_threshold(scores, wrong, alpha)
    if method == "ltt":
        return ltt_threshold(scores, wrong, alpha, delta)
    raise ValueError(f"unknown method {method!r}")


def guarantee_text(method: str, alpha: float, delta: float, n: int) -> str:
    if method == "crc":
        return (f"Conformal risk control on {n} held-out bugs: in expectation, at most {alpha:.0%} of bugs "
                f"end up with a wrong patch auto-merged.")
    return (f"Learn-then-Test on {n} held-out bugs: with probability at least {1 - delta:.0%}, at most "
            f"{alpha:.0%} of auto-merged patches are wrong.")
