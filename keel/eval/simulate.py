"""Simulated bug records, for testing the statistics and for the offline demo ONLY.

Every simulated record is flagged `"simulated": true` and the dashboard and PR bodies say so.
Real results come from `keel eval build` on QuixBugs / SWE-bench Lite.

The generative story: each bug has a latent difficulty; each model has a skill. A candidate is
correct with a probability depending on both. Correct candidates tend to agree with each other,
survive adversarial tests, be small and local, and have higher logprobs; wrong-but-plausible
candidates pass the visible tests often (that is the whole problem) but are noisier.
"""

from __future__ import annotations

import math
import random

MODELS = {  # name -> (skill, has_logprobs, $ per candidate)
    "muse-spark": (1.0, False, 0.012),
    "muse-spark-open": (0.6, True, 0.004),
    "muse-glimmer": (-0.2, True, 0.001),
}


def _sig(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def simulate(n_bugs: int = 300, k: int = 5, seed: int = 0, models: dict | None = None) -> list[dict]:
    rng = random.Random(seed)
    models = models or MODELS
    records = []
    for b in range(n_bugs):
        difficulty = rng.gauss(2.2, 1.6)
        cands = []
        # Wrong candidates of one bug often share the same plausible-but-wrong behaviour.
        n_wrong_modes = rng.choice([1, 1, 2, 3])
        for name, (skill, has_lp, cost) in models.items():
            for i in range(k):
                correct = rng.random() < _sig(skill - difficulty)
                visible_pass = correct or rng.random() < 0.35
                applied = rng.random() < 0.95
                gates = []
                if not applied:
                    gates.append("patch_did_not_apply")
                elif not visible_pass:
                    gates.append("failing_tests_still_fail")
                elif rng.random() < 0.03:
                    gates.append("modifies_tests_or_config")
                mode = 0 if correct else rng.randint(1, n_wrong_modes)
                # Some wrong patches behave like the correct one on every test Keel can run.
                if not correct and rng.random() < 0.25:
                    mode = 0
                q = 1.0 if correct else 0.0
                f = {
                    "f2p_rate": 1.0 if visible_pass else rng.uniform(0, 0.9),
                    "p2p_rate": 1.0 if visible_pass or rng.random() < 0.7 else rng.uniform(0.8, 1),
                    "attack_survival": min(1, max(0, rng.gauss(0.6 + 0.15 * q, 0.2))),
                    "attack_minority": min(1, max(0, rng.gauss(0.2 - 0.08 * q, 0.12))),
                    "log_diff_size": max(0.7, rng.gauss(2.2 + 0.3 * (1 - q) + 0.3 * difficulty, 0.8)),
                    "n_files": float(1 + (rng.random() < 0.2 + 0.2 * (1 - q))),
                    "n_hunks": float(1 + int(rng.expovariate(1.2 - 0.4 * (1 - q)))),
                    "frac_files_in_traceback": 1.0 if rng.random() < 0.6 + 0.25 * q else 0.0,
                    "log_line_distance": max(0, rng.gauss(2.0 - 0.4 * q, 1.0)),
                    "static_delta": float(rng.random() < 0.08 + 0.12 * (1 - q)),
                    "has_logprob": 1.0 if has_lp else 0.0,
                    "mean_logprob": rng.gauss(-0.22 + 0.06 * q, 0.1) if has_lp else 0.0,
                    "min_logprob": rng.gauss(-6 + 1 * q, 1.8) if has_lp else 0.0,
                    "log_reasoning_tokens": max(0, rng.gauss(6.0 + 0.4 * difficulty + 0.3 * (1 - q), 0.6)),
                    "self_confidence": min(1, max(0, rng.gauss(0.8 + 0.05 * q, 0.1))),
                }
                cands.append({"candidate_id": f"{name}-{i}", "generator": name, "features": f, "gates": gates,
                              "wrong": not correct, "cost_usd": cost * rng.uniform(0.7, 1.3), "_mode": mode,
                              "_applied": applied})
        # Agreement features from the latent behaviour modes.
        applied = [c for c in cands if c["_applied"]]
        for c in cands:
            others = [o for o in applied if o is not c]
            same = [o for o in others if o["_mode"] == c["_mode"]] if c["_applied"] else []
            n = max(1, len(others))
            noise = rng.uniform(-0.15, 0.15)
            c["features"]["behavior_agreement"] = min(1, max(0, len(same) / n + noise))
            c["features"]["exact_agreement"] = len(same) / n * rng.uniform(0.2, 0.7)
            c["features"]["mean_jaccard"] = min(1, len(same) / n * 0.8 + rng.uniform(0, 0.2))
            cross = [o for o in others if o["generator"] != c["generator"]]
            c["features"]["cross_model_agreement"] = (sum(o["_mode"] == c["_mode"] for o in cross) / len(cross)
                                                      if cross and c["_applied"] else 0.0)
            c["diff_hash"] = f"{b}-{c['_mode']}-{rng.randint(0, 3)}"
        for c in cands:
            del c["_mode"], c["_applied"]
        records.append({"task_id": f"sim-{b:04d}", "dataset": "simulated", "simulated": True, "candidates": cands})
    return records
