"""Explanations only mention signals that exist for this run."""

from keel.explain import reasons
from keel.types import Candidate, CandidateEvaluation


def _ev(**features):
    ev = CandidateEvaluation(candidate=Candidate("c0", "muse-spark", 0, "diff"), applied=True)
    ev.features = {"attack_survival": 0.5, "cross_model_agreement": 0.0, "exact_agreement": 0.6, **features}
    ev.contributions = {"attack_survival": -0.4, "cross_model_agreement": -0.3, "exact_agreement": 0.2}
    return ev


def test_single_model_without_adversarial_tests_mentions_neither():
    out = " ".join(reasons(_ev()))
    assert "adversarial" not in out and "other Meta model" not in out
    assert "same patch" in out


def test_signals_are_explained_when_present():
    out = " ".join(reasons(_ev(n_attack_tests=4.0, n_cross_model=5.0)))
    assert "adversarial" in out and "other Meta model" in out
