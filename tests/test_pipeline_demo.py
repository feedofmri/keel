from keel.calibration import Calibration
from keel.generators import ScriptedGenerator
from keel.pipeline import GeneratorSpec, Pipeline
from keel.report import pr_body
from keel.scoring import Scorer
from keel.types import AUTO_MERGE, NEEDS_REVIEW, BugTask


def _pipeline(responses, calibration=None):
    gens = [GeneratorSpec(ScriptedGenerator.from_file("muse-spark", responses / "muse-spark.json"), k=5),
            GeneratorSpec(ScriptedGenerator.from_file("muse-spark-open", responses / "muse-spark-open.json"), k=5)]
    return Pipeline(gens, attacker=ScriptedGenerator.from_file("attacker", responses / "attacker.json"),
                    calibration=calibration, log=lambda m: None)


def test_demo_end_to_end(demo_repo, responses):
    rep = _pipeline(responses).run(BugTask(task_id="demo", repo_path=str(demo_repo)))
    assert len(rep.task.failing_tests) == 3
    by_id = {e.candidate.candidate_id: e for e in rep.evaluations}
    # The test-tampering patch is gated, the empty response did not apply.
    assert "modifies_tests_or_config" in by_id["muse-spark-3"].gate_failures
    assert by_id["muse-spark-open-3"].gate_failures == ["patch_did_not_apply"]
    # The wrong rounding patch passes the visible tests but not the adversarial ones.
    wrong = by_id["muse-spark-open-1"]
    assert not wrong.gate_failures and sum(wrong.attack_results.values()) < len(wrong.attack_results)
    assert wrong.score > rep.selected.score
    # Without calibration Keel never auto-merges.
    assert rep.decision.label == NEEDS_REVIEW
    assert "never auto-merges" in rep.decision.reasons[0]
    assert "NEEDS REVIEW" in pr_body(rep)


def test_demo_with_calibration_auto_merges(demo_repo, responses):
    cal = Calibration(scorer=Scorer(), scores=[0.01] * 40 + [0.9] * 10, wrong=[False] * 40 + [True] * 10,
                      fingerprint="", simulated=True)
    rep = _pipeline(responses, cal).run(BugTask(task_id="demo", repo_path=str(demo_repo)))
    assert rep.decision.label == AUTO_MERGE
    assert "simulated" in rep.decision.guarantee
    assert rep.selected.candidate.generator in ("muse-spark", "muse-spark-open")


def test_stale_calibration_blocks(demo_repo, responses):
    cal = Calibration(scorer=Scorer(), scores=[0.01] * 50, wrong=[False] * 50, fingerprint="old")
    p = _pipeline(responses, cal)
    p.fingerprint = "new"
    rep = p.run(BugTask(task_id="demo", repo_path=str(demo_repo)))
    assert rep.decision.label == NEEDS_REVIEW
    assert any("recalibrate" in r for r in rep.decision.reasons)


def test_platform_report_payload_matches_schema(demo_repo, responses):
    from datetime import datetime, timezone

    from keel.github.platform import payload
    rep = _pipeline(responses).run(BugTask(task_id="demo", repo_path=str(demo_repo)))
    p = payload(rep, "workflow_run", 12, datetime.now(timezone.utc))
    assert set(p) >= {"trigger", "commit_sha", "n_candidates", "selected_score", "threshold", "decision", "pr_number", "cost_usd"}
    assert p["decision"] in ("AUTO-MERGE", "NEEDS REVIEW") and p["n_candidates"] == 10 and 0 <= p["selected_score"] <= 1
