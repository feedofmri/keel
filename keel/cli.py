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
    def ready(spec: str) -> bool:
        return spec.startswith("scripted:") or spec not in KNOWN_PROFILES or profile_from_env(spec).configured

    # A model listed in the settings but without a key is skipped, not fatal. The calibration
    # fingerprint then no longer matches, so Keel asks for review rather than auto-merging.
    missing = [m for m in models if not ready(m)]
    if missing:
        log(f"skipping {', '.join(missing)}: no API key or endpoint configured")
    models = [m for m in models if ready(m)]
    if not models:
        raise RuntimeError("no configured model: add the model's API key as a repository secret "
                           "(Keel app → repository → Settings → Models)")
    if attacker and not ready(attacker):
        log(f"adversarial tests disabled: {attacker} is not configured")
        attacker = None
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

    def log(m: str) -> None:
        print(f"[keel] {m}", file=sys.stderr)

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
    if not getattr(a, "ping", False):
        return 0
    # --ping: one tiny uncached request per configured endpoint, to catch a wrong URL, key or model id.
    import httpx
    failed = 0
    for name in KNOWN_PROFILES:
        p = profile_from_env(name)
        if not p.configured:
            continue
        body = {"model": p.model, "messages": [{"role": "user", "content": "Reply with the word OK."}],
                "max_tokens": 1024, "logprobs": True, **p.extra_body}
        try:
            post = lambda b, p=p: httpx.post(f"{p.base_url}/chat/completions", json=b, timeout=60,  # noqa: E731
                                        headers={"Authorization": f"Bearer {p.api_key}"})
            r, lp = post(body), None
            if r.status_code == 400:  # endpoint may reject logprobs; retry without, as the generator does
                body.pop("logprobs")
                r, lp = post(body), "rejected"
            if r.status_code != 200:
                failed += 1
                print(f"{name:16s} FAIL  HTTP {r.status_code}: {r.text[:300]}")
                continue
            choice = (r.json().get("choices") or [{}])[0]
            text = ((choice.get("message") or {}).get("content") or "").strip()
            lp = lp or ("returned" if (choice.get("logprobs") or {}).get("content") else "not returned")
            usage = r.json().get("usage") or {}
            reasoning = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens", "?")
            print(f"{name:16s} {'OK  ' if text else 'EMPTY'}  reply={text[:40]!r} finish={choice.get('finish_reason')} "
                  f"tokens in/out/reasoning={usage.get('prompt_tokens')}/{usage.get('completion_tokens')}/{reasoning} "
                  f"logprobs={lp}")
            failed += 0 if text else 1
        except httpx.HTTPError as e:
            failed += 1
            print(f"{name:16s} FAIL  {type(e).__name__}: {e}")
    return 1 if failed else 0


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
    d.add_argument("--ping", action="store_true", help="also send one short request to each configured endpoint")
    d.set_defaults(fn=cmd_doctor)

    from .eval.cli import add_eval_commands
    add_eval_commands(sub)
    from .github.action import add_action_command
    add_action_command(sub)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
