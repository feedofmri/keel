"""Run the Keel pipeline over a benchmark and record features + hidden-test labels."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from pathlib import Path

from ..pipeline import Pipeline
from ..sandbox import Workspace
from ..types import BugTask
from . import records as rec_io

Labeler = Callable[[Path], bool]  # patched workspace root -> correct?


def build_records(items: list[tuple[BugTask, Labeler]], pipeline: Pipeline, out: str | Path,
                  dataset: str, reports_dir: str | Path | None = None, log=print) -> list[dict]:
    """Append one record per task to `out` (JSONL). Tasks already in `out` are skipped (resumable)."""
    out = Path(out)
    done = {r["task_id"] for r in rec_io.load(out)} if out.exists() else set()
    new = []
    for task, labeler in items:
        if task.task_id in done:
            continue
        log(f"=== {task.task_id}")
        try:
            pipeline.prepare(task)
            if not task.failing_tests:
                log("no visible failing tests; skipping")
                continue
            cands = pipeline.generate(task)
            suite = pipeline.attack(task, cands)
            evals = pipeline.evaluate(task, cands, suite)
        except Exception as e:  # keep going on infrastructure errors, but record them
            log(f"error: {e!r}")
            continue
        labels: dict[str, bool] = {}
        with Workspace(task.repo_path) as ws:
            for ev in evals:
                h = hashlib.sha256(ev.candidate.diff.encode()).hexdigest()
                if h in labels:
                    continue
                if not ev.applied:
                    labels[h] = False
                    continue
                ws.reset()
                ok, _ = ws.apply_diff(ev.candidate.diff)
                labels[h] = bool(ok and labeler(ws.root))
        record = {
            "task_id": task.task_id, "dataset": dataset, "simulated": False,
            "failing_tests": task.failing_tests, "n_attack_tests": len(suite.test_ids) if suite else 0,
            "attack_cost_usd": suite.cost_usd if suite else 0.0,
            "candidates": [{
                "candidate_id": ev.candidate.candidate_id, "generator": ev.candidate.generator,
                "features": ev.features, "gates": ev.gate_failures,
                "wrong": not labels[hashlib.sha256(ev.candidate.diff.encode()).hexdigest()],
                "cost_usd": ev.candidate.cost_usd,
                "diff_hash": hashlib.sha256(ev.candidate.diff.encode()).hexdigest()[:16],
            } for ev in evals],
        }
        rec_io.append(out, record)
        new.append(record)
        n_ok = sum(1 for c in record["candidates"] if not c["wrong"])
        log(f"recorded {len(evals)} candidates, {n_ok} correct on hidden tests")
        if reports_dir:
            rd = Path(reports_dir)
            rd.mkdir(parents=True, exist_ok=True)
            (rd / (task.task_id.replace("/", "__") + ".json")).write_text(json.dumps(
                {"task": task.__dict__ | {"suspicious_locations": [loc.__dict__ for loc in task.suspicious_locations]},
                 "attack_tests": suite.source if suite else None,
                 "candidates": [{"id": ev.candidate.candidate_id, "diff": ev.candidate.diff,
                                 "gates": ev.gate_failures, "features": ev.features} for ev in evals]},
                indent=1, default=str))
    return new
