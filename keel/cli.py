"""Command-line interface: `keel repair | calibrate | eval | action | doctor`."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .calibration import Calibration, fingerprint
from .config import KeelConfig
from .generators import KNOWN_PROFILES, Generator, build_generator, profile_from_env
from .pipeline import GeneratorSpec, Pipeline
from .report import pr_body
from .types import BugTask


def _gen(spec: str | None, cache: str | None) -> Generator | None:
    return build_generator(spec, cache_dir=cache) if spec else None


def _model_id(spec: str) -> str:
    if spec.startswith("scripted:"):
        return spec
    return profile_from_env(spec).model


def build_pipeline(cfg: KeelConfig, models: list[str], attacker: str | None, triage: str | None,
                   explainer: str | None, calibration: str | None, cache: str | None,
                   allow_stale: bool = False, log=print) -> Pipeline:
    gens = [GeneratorSpec(build_generator(m, cache_dir=cache), k=cfg.k, temperature=cfg.temperature)
            for m in models]
    fp = fingerprint({g.generator.name: _model_id(m) for g, m in zip(gens, models)}, cfg.k,
                     attack=bool(attacker), triage=bool(triage))
    cal = Calibration.load(calibration) if calibration else None
    return Pipeline(gens, attacker=_gen(attacker, cache), triage=_gen(triage, cache),
                    explainer=_gen(explainer, cache), calibration=cal, alpha=cfg.alpha,
                    method=cfg.method, delta=cfg.delta, fingerprint=fp, allow_stale=allow_stale, log=log)


def cmd_repair(a: argparse.Namespace) -> int:
    repo = Path(a.repo).resolve()
    cfg = KeelConfig.load(repo)
    if a.alpha is not None:
        cfg.alpha = a.alpha
    if a.method:
        cfg.method = a.method
    if a.k:
        cfg.k = a.k
    models = a.models.split(",") if a.models else cfg.models
    attacker = None if a.no_attack else (a.attacker or cfg.attacker)
    log = (lambda m: print(f"[keel] {m}", file=sys.stderr))
    pipe = build_pipeline(cfg, models, attacker, a.triage or cfg.triage, a.explainer or cfg.explainer,
                          a.calibration or cfg.calibration, a.cache, a.allow_stale, log=log)
    task = BugTask(task_id=a.task_id or repo.name, repo_path=str(repo),
                   failing_tests=a.failing or [], test_command=cfg.test_command,
                   protected_globs=cfg.protected_globs, test_timeout=cfg.test_timeout,
                   problem_statement=Path(a.issue).read_text() if a.issue else "")
    report = pipe.run(task)
    body = pr_body(report, pipe.summary(report.decision))
    if a.json:
        Path(a.json).write_text(json.dumps(report.to_dict(), indent=1))
    if a.body:
        Path(a.body).write_text(body)
    if a.apply and report.selected and report.selected.applied:
        from .sandbox import git
        r = git(repo, "apply", "-", check=False, input=report.selected.candidate.diff)
        print("[keel] applied selected patch to working tree" if r.returncode == 0
              else f"[keel] could not apply: {r.stderr}", file=sys.stderr)
    print(body)
    return 0


def cmd_doctor(a: argparse.Namespace) -> int:
    """Check which Meta model endpoints are configured (never prints secrets)."""
    for name in KNOWN_PROFILES:
        p = profile_from_env(name)
        state = "configured" if p.configured else "missing " + ", ".join(
            x for x, v in (("BASE_URL", p.base_url), ("API_KEY", p.api_key), ("MODEL", p.model)) if not v)
        print(f"{name:16s} {state:40s} model={p.model or '-'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="keel", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("repair", help="repair failing tests in a repository")
    r.add_argument("--repo", default=".")
    r.add_argument("--failing", nargs="*", help="failing test node ids (default: discover)")
    r.add_argument("--issue", help="file with the issue / problem statement")
    r.add_argument("--models", help="comma-separated: muse-spark,muse-spark-open,muse-glimmer or scripted:NAME:FILE")
    r.add_argument("--attacker", help="model that writes adversarial tests")
    r.add_argument("--no-attack", action="store_true")
    r.add_argument("--triage")
    r.add_argument("--explainer")
    r.add_argument("--calibration", help="calibration JSON")
    r.add_argument("--alpha", type=float)
    r.add_argument("--method", choices=["crc", "ltt"])
    r.add_argument("--k", type=int)
    r.add_argument("--task-id")
    r.add_argument("--cache", default=os.environ.get("KEEL_CACHE", ".keel-cache"))
    r.add_argument("--allow-stale", action="store_true", help="use a calibration with a different fingerprint")
    r.add_argument("--json", help="write the full report as JSON")
    r.add_argument("--body", help="write the PR body Markdown here")
    r.add_argument("--apply", action="store_true", help="apply the selected patch to the repo")
    r.set_defaults(fn=cmd_repair)

    d = sub.add_parser("doctor", help="show which model endpoints are configured")
    d.set_defaults(fn=cmd_doctor)

    from .eval.cli import add_eval_commands
    add_eval_commands(sub)
    from .github.action import add_action_command
    add_action_command(sub)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
