"""`keel eval ...` and `keel calibrate` sub-commands."""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

from . import records as rec_io


def _log(m: str) -> None:
    print(f"[keel] {m}", file=sys.stderr)


def cmd_simulate(a: argparse.Namespace) -> int:
    from .simulate import simulate
    recs = simulate(a.n, k=a.k, seed=a.seed)
    rec_io.save(a.out, recs)
    _log(f"wrote {len(recs)} SIMULATED bug records to {a.out}")
    return 0


def _pipeline(a: argparse.Namespace):
    from ..cli import build_pipeline
    from ..config import KeelConfig
    cfg = KeelConfig(k=a.k)
    return build_pipeline(cfg, a.models.split(","), None if a.no_attack else a.attacker, a.triage, None, None,
                          a.cache, log=_log)


def cmd_quixbugs(a: argparse.Namespace) -> int:
    from .build import build_records
    from .quixbugs import build_all, hidden_label, load_tasks
    work = Path(a.work)
    tasks = load_tasks(work) if (work / "tasks.json").exists() and not a.rebuild else \
        build_all(Path(a.cache_dir), work, a.only.split(",") if a.only else None, log=_log)
    if a.only:
        tasks = [t for t in tasks if t.name in a.only.split(",")]
    pipe = _pipeline(a)
    items = [(t.bug_task(), (lambda root, t=t: hidden_label(t, root))) for t in tasks]
    build_records(items, pipe, a.out, "quixbugs", reports_dir=a.reports, log=_log)
    return 0


def cmd_swebench(a: argparse.Namespace) -> int:
    from . import swebench as sb
    insts = sb.load_instances(a.n, seed=a.seed)
    cache = Path(a.cache_dir)
    cand = Path(a.candidates)
    if a.stage in ("generate", "all"):
        sb.stage_generate(insts, _pipeline(a), cache, cand, log=_log)
    if a.stage in ("harness", "all"):
        sb.stage_harness(cand, Path(a.workdir), max_workers=a.workers, log=_log)
    if a.stage in ("records", "all"):
        sb.stage_records(insts, cand, Path(a.workdir), cache, None, Path(a.out), log=_log)
    return 0


def cmd_analyze(a: argparse.Namespace) -> int:
    from .runner import ablations, evaluate, model_comparison, slider_data
    recs = []
    for p in a.records:
        recs += rec_io.load(p)
    simulated = any(r.get("simulated") for r in recs)
    datasets = sorted({r["dataset"] for r in recs})
    _log(f"analysing {len(recs)} bugs from {datasets} ({'SIMULATED' if simulated else 'real'})")
    ev = evaluate(recs, n_splits=a.splits, delta=a.delta, seed=a.seed)
    out = {
        "simulated": simulated, "datasets": datasets, "n_bugs": len(recs),
        "n_candidates": sum(len(r["candidates"]) for r in recs),
        "generators": sorted({c["generator"] for r in recs for c in r["candidates"]}),
        "evaluation": ev,
        "slider": slider_data(recs, seed=a.seed),
        "models": model_comparison(recs, n_splits=max(20, a.splits // 4), seed=a.seed),
        "ablations": ablations(recs, n_splits=max(20, a.splits // 4), seed=a.seed),
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out, indent=1))
    _log(f"wrote {a.out}")
    return 0


def cmd_calibrate(a: argparse.Namespace) -> int:
    """Fit the scorer on part of the records and calibrate on the rest, for deployment."""
    from ..calibration import Calibration, fingerprint
    from .runner import fit_scorer, score_and_select
    recs = []
    for p in a.records:
        recs += rec_io.load(p)
    rng = random.Random(a.seed)
    idx = list(range(len(recs)))
    rng.shuffle(idx)
    cut = int(len(idx) * a.fit_fraction)
    fit = [recs[i] for i in idx[:cut]]
    cal = [recs[i] for i in idx[cut:]]
    scorer = fit_scorer(fit)
    sel = score_and_select(cal, scorer)
    fp = a.fingerprint or fingerprint({m: a.model_ids.get(m, m) for m in a.models.split(",")}, a.k,
                                      attack=not a.no_attack, triage=bool(a.triage))
    c = Calibration(scorer=scorer, scores=[s["score"] for s in sel], wrong=[s["wrong"] for s in sel],
                    fingerprint=fp, source=",".join(sorted({r["dataset"] for r in recs})),
                    simulated=any(r.get("simulated") for r in recs), task_ids=[s["task_id"] for s in sel])
    c.save(a.out)
    _log(f"calibration with {c.n} bugs written to {a.out}; threshold at α=10%: {c.threshold(0.1):.4f}")
    return 0


def _gen_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--models", default="muse-spark,muse-spark-open")
    p.add_argument("--attacker", default="muse-spark")
    p.add_argument("--no-attack", action="store_true")
    p.add_argument("--triage")
    p.add_argument("--k", type=int, default=5)
    p.add_argument("--cache", default=".keel-cache", help="model response cache")


def add_eval_commands(sub) -> None:
    ev = sub.add_parser("eval", help="benchmarks and analysis")
    es = ev.add_subparsers(dest="eval_cmd", required=True)

    s = es.add_parser("simulate", help="write SIMULATED records (for tests and the offline demo only)")
    s.add_argument("--out", default="results/simulated/records.jsonl")
    s.add_argument("--n", type=int, default=300)
    s.add_argument("--k", type=int, default=5)
    s.add_argument("--seed", type=int, default=0)
    s.set_defaults(fn=cmd_simulate)

    q = es.add_parser("quixbugs", help="run Keel on QuixBugs and record hidden-test labels")
    _gen_args(q)
    q.add_argument("--work", default="results/quixbugs/work")
    q.add_argument("--cache-dir", default=str(Path.home() / ".cache" / "keel"))
    q.add_argument("--out", default="results/quixbugs/records.jsonl")
    q.add_argument("--reports", default="results/quixbugs/reports")
    q.add_argument("--only", help="comma-separated program names")
    q.add_argument("--rebuild", action="store_true")
    q.set_defaults(fn=cmd_quixbugs)

    w = es.add_parser("swebench", help="SWE-bench Lite: generate / harness / records")
    _gen_args(w)
    w.add_argument("--stage", choices=["generate", "harness", "records", "all"], default="all")
    w.add_argument("--n", type=int, default=100, help="instances (fixed-seed random subset)")
    w.add_argument("--seed", type=int, default=0)
    w.add_argument("--cache-dir", default=str(Path.home() / ".cache" / "keel"))
    w.add_argument("--candidates", default="results/swebench/candidates.jsonl")
    w.add_argument("--workdir", default="results/swebench/harness")
    w.add_argument("--workers", type=int, default=4)
    w.add_argument("--out", default="results/swebench/records.jsonl")
    w.set_defaults(fn=cmd_swebench)

    an = es.add_parser("analyze", help="repeated-split analysis -> dashboard JSON")
    an.add_argument("records", nargs="+")
    an.add_argument("--out", default="site/data/results.json")
    an.add_argument("--splits", type=int, default=200)
    an.add_argument("--delta", type=float, default=0.1)
    an.add_argument("--seed", type=int, default=0)
    an.set_defaults(fn=cmd_analyze)

    c = sub.add_parser("calibrate", help="build a deployment calibration from records")
    c.add_argument("records", nargs="+")
    c.add_argument("--out", default="calibration.json")
    c.add_argument("--fit-fraction", type=float, default=0.4)
    c.add_argument("--seed", type=int, default=0)
    c.add_argument("--models", default="muse-spark,muse-spark-open")
    c.add_argument("--k", type=int, default=5)
    c.add_argument("--no-attack", action="store_true")
    c.add_argument("--triage")
    c.add_argument("--fingerprint", help="override the computed fingerprint")
    c.set_defaults(fn=cmd_calibrate, model_ids={})
