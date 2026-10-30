"""Code-aware features for each candidate patch."""

from __future__ import annotations

import math

from .diffutil import changed_tokens, diff_stats, jaccard
from .types import BugTask, CandidateEvaluation

FEATURE_NAMES = [
    "f2p_rate", "p2p_rate",
    "attack_survival", "attack_minority",
    "log_diff_size", "n_files", "n_hunks",
    "frac_files_in_traceback", "log_line_distance",
    "static_delta",
    "exact_agreement", "behavior_agreement", "mean_jaccard", "cross_model_agreement", "consensus_score",
    "has_logprob", "mean_logprob", "min_logprob", "log_reasoning_tokens",
    "self_confidence",
]

FAR = 1000  # line distance used when no hunk is in a traceback file


def gate_failures(ev: CandidateEvaluation) -> list[str]:
    """Hard conditions under which a patch is never auto-merged."""
    g = []
    if not ev.applied:
        g.append("patch_did_not_apply")
        return g
    if ev.timed_out:
        g.append("tests_timed_out")
    if ev.fail_to_pass and not all(ev.fail_to_pass.values()):
        g.append("failing_tests_still_fail")
    if ev.pass_to_pass and not all(ev.pass_to_pass.values()):
        g.append("regression_in_passing_tests")
    if ev.syntax_error:
        g.append("syntax_error")
    if ev.touches_protected:
        g.append("modifies_tests_or_config")
    return g


def _rate(d: dict[str, bool]) -> float:
    return sum(d.values()) / len(d) if d else 1.0


def _locality(task: BugTask, diff: str) -> tuple[float, float]:
    st = diff_stats(diff)
    tb_files = {loc.path for loc in task.suspicious_locations}
    if not st.paths:
        return 0.0, math.log1p(FAR)
    frac = sum(1 for p in st.paths if p in tb_files) / len(st.paths)
    best = FAR
    for path, lo, hi in st.ranges:
        for loc in task.suspicious_locations:
            if loc.path == path:
                d = 0 if lo <= loc.line <= hi else min(abs(loc.line - lo), abs(loc.line - hi))
                best = min(best, d)
    return frac, math.log1p(best)


def compute_features(task: BugTask, evals: list[CandidateEvaluation]) -> None:
    """Fill `features` and `gate_failures` on every evaluation in place."""
    applied = [e for e in evals if e.applied]
    toks = {id(e): changed_tokens(e.candidate.diff) for e in applied}

    # Majority outcome of each adversarial test across applied candidates.
    attack_tests = sorted({t for e in applied for t in e.attack_results})
    majority = {}
    for t in attack_tests:
        votes = [e.attack_results.get(t, False) for e in applied]
        majority[t] = sum(votes) * 2 >= len(votes)
    useful_tests = [t for t in attack_tests if any(e.attack_results.get(t) for e in applied)]

    # CodeT/Agentless-style consensus: candidates with identical behaviour form a group, scored
    # |group| x (tests passed)^2, normalised to [0, 1] within the bug.
    groups: dict[str, int] = {}
    for e in applied:
        groups[e.behavior_signature] = groups.get(e.behavior_signature, 0) + 1
    raw = {sig: n * (sig.count("1") ** 2) for sig, n in groups.items()}
    top = max(raw.values()) if raw else 0

    for e in evals:
        e.gate_failures = gate_failures(e)
        st = diff_stats(e.candidate.diff)
        frac_tb, log_dist = _locality(task, e.candidate.diff)
        others = [o for o in applied if o is not e]
        if e.applied and others:
            exact = sum(o.normalized_diff == e.normalized_diff for o in others) / len(others)
            behav = sum(o.behavior_signature == e.behavior_signature for o in others) / len(others)
            jac = sum(jaccard(toks[id(e)], toks[id(o)]) for o in others) / len(others)
            cross = [o for o in others if o.candidate.generator != e.candidate.generator]
            cross_agree = (sum(o.behavior_signature == e.behavior_signature for o in cross) / len(cross)
                           if cross else 0.0)
        else:
            exact = behav = jac = cross_agree = 0.0
        if useful_tests and e.applied:
            survival = sum(e.attack_results.get(t, False) for t in useful_tests) / len(useful_tests)
            minority = sum(e.attack_results.get(t, False) != majority[t] for t in attack_tests) / len(attack_tests)
        else:
            survival, minority = 0.5, 0.0
        c = e.candidate
        e.features = {
            "f2p_rate": _rate(e.fail_to_pass) if e.applied else 0.0,
            "p2p_rate": _rate(e.pass_to_pass) if e.applied else 0.0,
            "attack_survival": survival,
            "attack_minority": minority,
            "log_diff_size": math.log1p(st.added + st.removed),
            "n_files": float(st.files),
            "n_hunks": float(st.hunks),
            "frac_files_in_traceback": frac_tb,
            "log_line_distance": log_dist,
            "static_delta": float(e.static_after - e.static_before),
            "exact_agreement": exact,
            "behavior_agreement": behav,
            "mean_jaccard": jac,
            "cross_model_agreement": cross_agree,
            "consensus_score": (raw.get(e.behavior_signature, 0) / top) if (e.applied and top) else 0.0,
            "has_logprob": 1.0 if c.mean_logprob is not None else 0.0,
            "mean_logprob": c.mean_logprob if c.mean_logprob is not None else 0.0,
            "min_logprob": max(c.min_logprob, -20.0) if c.min_logprob is not None else 0.0,
            "log_reasoning_tokens": math.log1p(c.reasoning_tokens),
            "self_confidence": c.self_confidence if c.self_confidence is not None else 0.5,
            # Not scored (outside FEATURE_NAMES): whether a signal exists at all, so explanations
            # don't present the neutral defaults above as findings.
            "n_attack_tests": float(len(useful_tests)) if e.applied else 0.0,
            "n_cross_model": float(len(cross)) if (e.applied and others) else 0.0,
        }
