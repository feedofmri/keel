from keel.eval.runner import evaluate, model_comparison
from keel.eval.simulate import simulate


def test_simulated_evaluation_respects_bound():
    recs = simulate(240, seed=3)
    ev = evaluate(recs, alphas=[0.1, 0.2], n_splits=60, seed=0)
    for row in ev["methods"]["keel_crc"]:
        assert row["risk"] <= row["alpha"] + 0.02
    # The naive "tests pass" rule ignores alpha entirely.
    tp = ev["methods"]["tests_pass"]
    assert tp[0]["risk"] == tp[1]["risk"]
    assert 0.5 < ev["auroc"] <= 1.0


def test_model_comparison_rows():
    rows = model_comparison(simulate(120, seed=4), n_splits=10)
    names = {r["models"] for r in rows}
    assert "muse-spark" in names and any("+" in n for n in names)
