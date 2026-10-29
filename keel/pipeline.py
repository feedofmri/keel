"""End-to-end Keel pipeline: baseline -> triage -> generate -> attack -> evaluate -> score -> decide."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass

from . import conformal, explain
from .attack import AttackSuite, build_attack_suite
from .calibration import Calibration
from .context import explain_messages, repair_messages, test_files_for, triage_messages
from .diffutil import diff_stats, normalized_diff
from .edits import EditError, apply_edits, parse_confidence, parse_diff_blocks, parse_edits
from .features import compute_features
from .generators import Generator
from .sandbox import Workspace, is_protected, touches_protected
from .scoring import Scorer
from .static_analysis import analyze_files
from .testing import collect_tests, extract_locations, locations_from_imports, norm_test_id, run_tests
from .types import AUTO_MERGE, NEEDS_REVIEW, BugTask, Candidate, CandidateEvaluation, Decision, RepairReport


@dataclass
class GeneratorSpec:
    generator: Generator
    k: int = 5
    temperature: float = 0.8


class Pipeline:
    def __init__(self, generators: list[GeneratorSpec], attacker: Generator | None = None,
                 triage: Generator | None = None, explainer: Generator | None = None,
                 scorer: Scorer | None = None, calibration: Calibration | None = None,
                 alpha: float = 0.1, method: str = "crc", delta: float = 0.1,
                 fingerprint: str = "", allow_stale: bool = False, seed: int = 0,
                 log: Callable[[str], None] = print):
        self.generators = generators
        self.attacker = attacker
        self.triage = triage
        self.explainer = explainer
        self.calibration = calibration
        self.scorer = scorer or (calibration.scorer if calibration else Scorer())
        self.alpha, self.method, self.delta = alpha, method, delta
        self.fingerprint = fingerprint
        self.allow_stale = allow_stale
        self.seed = seed
        self.log = log

    # 1. Baseline ---------------------------------------------------------------------------
    def prepare(self, task: BugTask) -> BugTask:
        with Workspace(task.repo_path) as ws:
            if not task.failing_tests or not task.passing_tests:
                nodes = collect_tests(ws.root)
                by_norm = {norm_test_id(n): n for n in nodes}
                full = run_tests(ws.root, [], task.test_command, task.test_timeout)
                status = {by_norm[k]: v for k, v in full.results.items() if k in by_norm}
                if not task.failing_tests:
                    task.failing_tests = sorted(t for t, ok in status.items() if not ok)
                if not task.passing_tests:
                    task.passing_tests = sorted(t for t, ok in status.items()
                                                if ok and t not in task.failing_tests)
            if task.failing_tests:
                out = run_tests(ws.root, task.failing_tests, task.test_command, task.test_timeout)
                task.failure_output = out.output
                locs = extract_locations(out.output, ws.root)
                if not any(not is_protected(loc.path, task.protected_globs) for loc in locs):
                    locs += locations_from_imports(ws.root, test_files_for(task))
                task.suspicious_locations = locs
        self.log(f"baseline: {len(task.failing_tests)} failing, {len(task.passing_tests)} passing, "
                 f"{len(task.suspicious_locations)} traceback locations")
        return task

    # 2-3. Triage + generation ----------------------------------------------------------------
    def _budget(self, task: BugTask, k: int) -> int:
        if not self.triage:
            return k
        comps = self.triage.complete(triage_messages(task), n=1, temperature=0.0, seed=self.seed, max_tokens=8)
        word = (comps[0].text if comps else "").strip().lower()
        if word.startswith("easy"):
            return max(1, (k + 1) // 2)
        return k

    def _materialise(self, task: BugTask, ws: Workspace, text: str) -> tuple[str, str]:
        ws.reset()
        try:
            edits = parse_edits(text)
            if edits:
                apply_edits(ws.root, edits)
            else:
                blocks = parse_diff_blocks(text)
                if not blocks:
                    return "", "no edits found in response"
                ok, err = ws.apply_diff(blocks[0])
                if not ok:
                    return "", f"diff did not apply: {err[:200]}"
        except EditError as e:
            return "", str(e)
        diff = ws.diff()
        return diff, "" if diff.strip() else "edits produced no change"

    def generate(self, task: BugTask) -> list[Candidate]:
        cands: list[Candidate] = []
        with Workspace(task.repo_path) as ws:
            messages = repair_messages(task, ws.root)
            for spec in self.generators:
                k = self._budget(task, spec.k)
                comps = spec.generator.complete(messages, n=k, temperature=spec.temperature, seed=self.seed)
                for i, c in enumerate(comps):
                    diff, err = ("", c.error) if c.error else self._materialise(task, ws, c.text)
                    cid = f"{spec.generator.name}-{i}"
                    cands.append(Candidate(
                        candidate_id=cid, generator=spec.generator.name, sample_index=i, diff=diff,
                        self_confidence=parse_confidence(c.text), raw_response=c.text,
                        prompt_tokens=c.prompt_tokens, completion_tokens=c.completion_tokens,
                        reasoning_tokens=c.reasoning_tokens, mean_logprob=c.mean_logprob,
                        min_logprob=c.min_logprob, cost_usd=c.cost_usd, latency_s=c.latency_s, error=err))
                ok = sum(1 for c in cands if c.generator == spec.generator.name and c.diff)
                self.log(f"generate: {spec.generator.name} produced {ok}/{k} usable patches")
        return cands

    # 4-5. Attack + evaluation ----------------------------------------------------------------
    def attack(self, task: BugTask, cands: list[Candidate]) -> AttackSuite | None:
        if not self.attacker:
            return None
        with Workspace(task.repo_path) as ws:
            suite = build_attack_suite(task, ws.root, [c.diff for c in cands], self.attacker, seed=self.seed)
        self.log(f"attack: {len(suite.test_ids) if suite else 0} adversarial tests written")
        return suite

    def evaluate(self, task: BugTask, cands: list[Candidate], suite: AttackSuite | None) -> list[CandidateEvaluation]:
        cache: dict[str, CandidateEvaluation] = {}
        evals: list[CandidateEvaluation] = []
        tests = list(task.failing_tests) + list(task.passing_tests)
        attack_ids = suite.test_ids if suite else []
        with Workspace(task.repo_path) as ws:
            for c in cands:
                key = hashlib.sha256(c.diff.encode()).hexdigest()
                if key in cache:
                    proto = cache[key]
                    ev = CandidateEvaluation(**{**proto.__dict__, "candidate": c, "features": {},
                                                "contributions": {}, "gate_failures": []})
                    evals.append(ev)
                    continue
                ev = CandidateEvaluation(candidate=c, applied=False, apply_error=c.error)
                if c.diff.strip():
                    ws.reset()
                    paths = diff_stats(c.diff).paths
                    ev.static_before, _ = analyze_files(ws.root, paths)
                    ok, err = ws.apply_diff(c.diff)
                    ev.applied, ev.apply_error = ok, err
                    if ok:
                        ev.static_after, syn = analyze_files(ws.root, paths)
                        ev.syntax_error = syn > 0
                        ev.touches_protected = touches_protected(c.diff, task.protected_globs)
                        if suite:
                            suite.install(ws.root)
                        out = run_tests(ws.root, tests + attack_ids, task.test_command, task.test_timeout)
                        ev.timed_out = out.timed_out
                        ev.fail_to_pass = {t: out.results.get(t, False) for t in task.failing_tests}
                        ev.pass_to_pass = {t: out.results.get(t, False) for t in task.passing_tests}
                        ev.attack_results = {t: out.results.get(t, False) for t in attack_ids}
                        sig = [ev.fail_to_pass[t] for t in task.failing_tests] + \
                              [ev.pass_to_pass[t] for t in task.passing_tests] + \
                              [ev.attack_results[t] for t in attack_ids]
                        ev.behavior_signature = "".join("1" if x else "0" for x in sig)
                        ev.normalized_diff = normalized_diff(c.diff)
                cache[key] = ev
                evals.append(ev)
        compute_features(task, evals)
        for ev in evals:
            ev.score = self.scorer.score(ev.features, ev.gate_failures)
            ev.contributions = self.scorer.contributions(ev.features) if not ev.gate_failures else {}
        n_ok = sum(1 for e in evals if not e.gate_failures)
        self.log(f"evaluate: {n_ok}/{len(evals)} candidates pass all gates")
        return evals

    # 6-7. Selection + decision --------------------------------------------------------------
    @staticmethod
    def select(evals: list[CandidateEvaluation]) -> CandidateEvaluation | None:
        if not evals:
            return None
        return min(evals, key=lambda e: (e.score, -e.features.get("behavior_agreement", 0.0),
                                         e.features.get("log_diff_size", 0.0), e.candidate.candidate_id))

    def decide(self, selected: CandidateEvaluation | None) -> Decision:
        cal = self.calibration
        notes: list[str] = []
        if cal is None:
            thr = conformal.NEVER
            notes.append("Keel has no calibration data, so it never auto-merges")
        elif cal.fingerprint and self.fingerprint and cal.fingerprint != self.fingerprint and not self.allow_stale:
            thr = conformal.NEVER
            notes.append("calibration was made with different models/prompts; recalibrate before auto-merging")
        else:
            thr = cal.threshold(self.alpha, self.method, self.delta)
            if thr == conformal.NEVER:
                notes.append(f"with {cal.n} calibration bugs no threshold certifies α={self.alpha:.0%}")
        score = selected.score if selected else 1.0
        label = AUTO_MERGE if selected and not selected.gate_failures and score <= thr else NEEDS_REVIEW
        rs = explain.reasons(selected)
        if label == NEEDS_REVIEW and selected and not selected.gate_failures and thr > conformal.NEVER:
            rs.insert(0, f"Risk score {score:.3f} is above the calibrated threshold {thr:.3f}")
        elif label == AUTO_MERGE:
            rs.insert(0, f"Risk score {score:.3f} is within the calibrated threshold {thr:.3f}")
        rs = notes + rs
        n = cal.n if cal else 0
        guarantee = conformal.guarantee_text(self.method, self.alpha, self.delta, n)
        if cal is not None and cal.simulated:
            guarantee += " (DEMO: calibrated on simulated data, not a real guarantee)"
        return Decision(label=label, alpha=self.alpha, method=self.method, threshold=thr, score=score,
                        candidate_id=selected.candidate.candidate_id if selected else None,
                        reasons=rs, guarantee=guarantee, n_calibration=n)

    def summary(self, decision: Decision) -> str:
        """Plain-English explanation, written by the explainer model if one is configured."""
        if not self.explainer:
            return ""
        comps = self.explainer.complete(explain_messages(decision.label, decision.reasons, decision.guarantee),
                                        n=1, temperature=0.2, seed=self.seed, max_tokens=300)
        return comps[0].text.strip() if comps and not comps[0].error else ""

    def run(self, task: BugTask) -> RepairReport:
        self.prepare(task)
        if not task.failing_tests:
            decision = Decision(label=NEEDS_REVIEW, alpha=self.alpha, method=self.method,
                                threshold=conformal.NEVER, score=1.0, candidate_id=None,
                                reasons=["no failing tests found; nothing to repair"], guarantee="")
            return RepairReport(task=task, evaluations=[], selected=None, decision=decision)
        cands = self.generate(task)
        suite = self.attack(task, cands)
        evals = self.evaluate(task, cands, suite)
        selected = self.select(evals)
        decision = self.decide(selected)
        self.log(f"decision: {decision.label} (score {decision.score:.3f}, threshold {decision.threshold:.3f})")
        cost = sum(c.cost_usd for c in cands) + (suite.cost_usd if suite else 0.0)
        return RepairReport(task=task, evaluations=evals, selected=selected, decision=decision,
                            total_cost_usd=cost)
