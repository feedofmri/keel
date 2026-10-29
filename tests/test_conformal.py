import random

from keel import conformal


def _draw(rng, n, base_wrong=0.4):
    """Scores where wrong patches tend to score higher."""
    out = []
    for _ in range(n):
        wrong = rng.random() < base_wrong
        s = min(0.999, max(0.0, rng.gauss(0.6 if wrong else 0.25, 0.2)))
        out.append((s, wrong))
    return out


def test_crc_controls_expected_risk():
    rng = random.Random(0)
    for alpha in (0.05, 0.1, 0.2):
        risks = []
        for _ in range(400):
            cal = _draw(rng, 100)
            test = _draw(rng, 200)
            thr = conformal.crc_threshold([s for s, _ in cal], [w for _, w in cal], alpha)
            risks.append(conformal.rule_stats([s for s, _ in test], [w for _, w in test], thr).risk)
        assert sum(risks) / len(risks) <= alpha + 0.005, (alpha, sum(risks) / len(risks))


def test_ltt_controls_fdr_with_high_probability():
    rng = random.Random(1)
    alpha, delta = 0.2, 0.1
    violations = 0
    trials = 300
    for _ in range(trials):
        cal = _draw(rng, 300)
        test = _draw(rng, 2000)
        thr = conformal.ltt_threshold([s for s, _ in cal], [w for _, w in cal], alpha, delta)
        st = conformal.rule_stats([s for s, _ in test], [w for _, w in test], thr)
        violations += st.n_merged > 0 and st.fdr > alpha
    assert violations / trials <= delta


def test_never_merges_gated_or_without_data():
    assert conformal.crc_threshold([], [], 0.1) == conformal.NEVER
    assert conformal.crc_threshold([1.0, 1.0], [False, False], 0.5) == conformal.NEVER
    # Too few calibration points for alpha: (0 + 1) / (n + 1) > alpha
    assert conformal.crc_threshold([0.1] * 5, [False] * 5, 0.1) == conformal.NEVER


def test_crc_threshold_monotone_in_alpha():
    rng = random.Random(2)
    cal = _draw(rng, 200)
    s, w = [x for x, _ in cal], [y for _, y in cal]
    thr = [conformal.crc_threshold(s, w, a) for a in (0.02, 0.05, 0.1, 0.2, 0.4)]
    assert thr == sorted(thr)


def test_binom_pvalue():
    assert conformal.binom_pvalue(0, 0, 0.1) == 1.0
    assert abs(conformal.binom_pvalue(0, 10, 0.1) - 0.9 ** 10) < 1e-12
