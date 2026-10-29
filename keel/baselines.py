"""Naive decision rules Keel is compared against.

Each takes per-bug records (of the selected candidate) and returns merge decisions.
"""

from __future__ import annotations

from collections.abc import Callable


def tests_pass(rec: dict, alpha: float) -> bool:
    """Merge whenever the visible tests pass (what most agents do today)."""
    return not rec["gates"]


def self_confidence(rec: dict, alpha: float) -> bool:
    """Merge when the model says it is at least (1 - alpha) confident."""
    conf = rec["features"].get("self_confidence", 0.5)
    return not rec["gates"] and conf >= 1 - alpha


def uncalibrated_score(rec: dict, alpha: float) -> bool:
    """Keel's own score with the naive cut-off p(correct) >= 1 - alpha, no conformal step."""
    return not rec["gates"] and rec["score"] <= alpha


BASELINES: dict[str, Callable[[dict, float], bool]] = {
    "tests_pass": tests_pass,
    "self_confidence": self_confidence,
    "uncalibrated_score": uncalibrated_score,
}
