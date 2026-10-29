"""Human-readable reasons for a decision."""

from __future__ import annotations

from .types import CandidateEvaluation

GATE_TEXT = {
    "patch_did_not_apply": "the patch could not be applied to the repository",
    "tests_timed_out": "the test run timed out",
    "failing_tests_still_fail": "some of the originally failing tests still fail",
    "regression_in_passing_tests": "it breaks tests that passed before",
    "syntax_error": "it introduces a syntax error",
    "modifies_tests_or_config": "it modifies tests, CI or Keel config (tests are the spec)",
}

FEATURE_TEXT = {
    "attack_survival": ("passes {v:.0%} of the adversarial tests written by Muse Spark",
                        "fails {inv:.0%} of the adversarial tests written by Muse Spark"),
    "attack_minority": ("agrees with the other candidates on the adversarial tests",
                        "behaves differently from most other candidates on {v:.0%} of adversarial tests"),
    "behavior_agreement": ("{v:.0%} of other samples behave identically",
                           "only {v:.0%} of other samples behave the same way"),
    "cross_model_agreement": ("the other Meta model independently reached the same behaviour",
                              "the other Meta model does not agree ({v:.0%} matching)"),
    "exact_agreement": ("{v:.0%} of samples produced the same patch",
                        "few samples produced the same patch ({v:.0%})"),
    "consensus_score": ("belongs to the largest group of candidates that pass the same tests",
                        "is not in the main consensus group of candidates"),
    "log_diff_size": ("the change is small and targeted", "the change is large"),
    "n_files": ("touches few files", "touches {raw:.0f} files"),
    "frac_files_in_traceback": ("edits the code named in the failing traceback",
                                "edits code outside the failing traceback"),
    "log_line_distance": ("the edit is close to the failure site", "the edit is far from the failure site"),
    "static_delta": ("no new static-analysis warnings", "adds {raw:.0f} new static-analysis warnings"),
    "mean_logprob": ("Muse Spark Open was confident while writing it",
                     "Muse Spark Open was uncertain while writing it"),
    "self_confidence": ("the model reports high confidence", "the model reports low confidence"),
}


def reasons(ev: CandidateEvaluation | None, top: int = 4) -> list[str]:
    if ev is None:
        return ["no candidate patch could be produced"]
    if ev.gate_failures:
        return [f"Blocked: {GATE_TEXT.get(g, g)}" for g in ev.gate_failures]
    out = []
    items = sorted(ev.contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)
    for name, c in items:
        if name not in FEATURE_TEXT or abs(c) < 0.05:
            continue
        raw = ev.features.get(name, 0.0)
        good, bad = FEATURE_TEXT[name]
        tmpl = good if c > 0 else bad
        sign = "+" if c > 0 else "−"
        out.append(f"{sign} " + tmpl.format(v=raw, inv=1 - raw, raw=raw if name != "n_files" else raw))
        if len(out) >= top:
            break
    return out or ["no strong signals either way"]
