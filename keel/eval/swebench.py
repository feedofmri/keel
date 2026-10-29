"""SWE-bench Lite adapter (Jimenez et al., 2024; MIT license), downloaded at run time.

Three resumable stages, because the official harness needs Docker and is slow:

1. `generate`: for each instance, check out the repository at its base commit and let the
   Keel generators write k candidate patches each (from the issue text plus the *visible*
   half of FAIL_TO_PASS test names). Candidates are stored in JSONL.
2. `harness`: run the official `swebench` harness once per (model, sample index), so every
   candidate is executed in the instance's prebuilt Docker image.
3. `records`: turn harness reports into Keel records. Features only read the visible
   FAIL_TO_PASS tests; the label `wrong` is "not resolved" under the full hidden suite
   (all FAIL_TO_PASS + PASS_TO_PASS).

Adversarial tests are not used on SWE-bench (they would need a container per candidate);
those features are left neutral and the ablation reports this.
"""

from __future__ import annotations

import json
import random
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

import httpx

from ..diffutil import diff_stats, normalized_diff
from ..features import compute_features
from ..pipeline import Pipeline
from ..sandbox import Workspace, git, touches_protected
from ..static_analysis import analyze_files
from ..types import BugTask, Candidate, CandidateEvaluation
from . import records as rec_io

DATASET = "SWE-bench/SWE-bench_Lite"
ROWS_API = "https://datasets-server.huggingface.co/rows"


def load_instances(n: int | None = 100, seed: int = 0, dataset: str = DATASET) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        r = httpx.get(ROWS_API, params={"dataset": dataset, "config": "default", "split": "test",
                                        "offset": offset, "length": 100}, timeout=60)
        r.raise_for_status()
        batch = [x["row"] for x in r.json()["rows"]]
        rows += batch
        if len(batch) < 100:
            break
        offset += 100
    for x in rows:
        for key in ("FAIL_TO_PASS", "PASS_TO_PASS"):
            if isinstance(x[key], str):
                x[key] = json.loads(x[key])
    rows.sort(key=lambda x: x["instance_id"])
    if n is not None and n < len(rows):
        rows = random.Random(seed).sample(rows, n)
        rows.sort(key=lambda x: x["instance_id"])
    return rows


def visible_tests(inst: dict) -> list[str]:
    """Deterministic visible half of FAIL_TO_PASS (at least one test)."""
    f2p = list(inst["FAIL_TO_PASS"])
    return f2p[::2] or f2p[:1]


def checkout(inst: dict, cache: Path) -> Path:
    dest = cache / "repos" / inst["instance_id"]
    if (dest / ".git").exists():
        return dest
    dest.mkdir(parents=True, exist_ok=True)
    git(dest, "init", "-q")
    git(dest, "remote", "add", "origin", f"https://github.com/{inst['repo']}")
    git(dest, "fetch", "-q", "--depth", "1", "origin", inst["base_commit"])
    git(dest, "checkout", "-q", "FETCH_HEAD")
    return dest


def bug_task(inst: dict, repo: Path) -> BugTask:
    vis = visible_tests(inst)
    out = ("These tests fail before the fix and must pass after it:\n" + "\n".join(vis))
    return BugTask(task_id=inst["instance_id"], repo_path=str(repo), failing_tests=vis,
                   problem_statement=inst["problem_statement"], failure_output=out)


def stage_generate(instances: list[dict], pipeline: Pipeline, cache: Path, out: Path, log=print) -> None:
    done = {json.loads(ln)["instance_id"] for ln in out.read_text().splitlines()} if out.exists() else set()
    for inst in instances:
        if inst["instance_id"] in done:
            continue
        log(f"=== {inst['instance_id']}")
        try:
            repo = checkout(inst, cache)
        except subprocess.CalledProcessError as e:
            log(f"checkout failed: {e.stderr}")
            continue
        task = bug_task(inst, repo)
        cands = pipeline.generate(task)
        with open(out, "a") as f:
            f.write(json.dumps({"instance_id": inst["instance_id"], "candidates": [asdict(c) for c in cands]}) + "\n")


def run_ids(cand_file: Path) -> list[str]:
    rows = [json.loads(ln) for ln in cand_file.read_text().splitlines() if ln.strip()]
    return sorted({f"keel-{c['generator']}-{c['sample_index']}" for r in rows for c in r["candidates"]})


def stage_harness(cand_file: Path, workdir: Path, max_workers: int = 4, dataset: str = DATASET,
                  extra_args: list[str] | None = None, only: list[str] | None = None, log=print) -> None:
    """Run the official harness once per (generator, sample index)."""
    rows = [json.loads(ln) for ln in cand_file.read_text().splitlines() if ln.strip()]
    groups: dict[str, list[dict]] = {}
    for row in rows:
        for c in row["candidates"]:
            groups.setdefault(f"keel-{c['generator']}-{c['sample_index']}", []).append(
                {"instance_id": row["instance_id"], "model_name_or_path": f"keel-{c['generator']}-{c['sample_index']}",
                 "model_patch": c["diff"]})
    workdir.mkdir(parents=True, exist_ok=True)
    for run_id, preds in sorted(groups.items()):
        if only and run_id not in only:
            continue
        pred_path = workdir / f"{run_id}.jsonl"
        pred_path.write_text("\n".join(json.dumps(p) for p in preds) + "\n")
        log(f"harness: {run_id} ({len(preds)} predictions)")
        cmd = [sys.executable, "-m", "swebench.harness.run_evaluation", "--dataset_name", dataset,
               "--predictions_path", str(pred_path.resolve()), "--max_workers", str(max_workers),
               "--run_id", run_id, *(extra_args or ["--cache_level", "env"])]
        subprocess.run(cmd, cwd=workdir, check=False)


def _report(workdir: Path, run_id: str, instance_id: str) -> dict | None:
    p = workdir / "logs" / "run_evaluation" / run_id / run_id / instance_id / "report.json"
    if not p.exists():
        return None
    return json.loads(p.read_text()).get(instance_id)


def stage_records(instances: list[dict], cand_file: Path, workdir: Path, cache: Path, scorer_pipeline: Pipeline,
                  out: Path, log=print) -> None:
    by_id = {i["instance_id"]: i for i in instances}
    rows = [json.loads(ln) for ln in cand_file.read_text().splitlines() if ln.strip()]
    records = []
    for row in rows:
        inst = by_id.get(row["instance_id"])
        if not inst:
            continue
        repo = checkout(inst, cache)
        task = bug_task(inst, repo)
        evals, labels = [], []
        with Workspace(repo) as ws:
            for cd in row["candidates"]:
                c = Candidate(**cd)
                run_id = f"keel-{c.generator}-{c.sample_index}"
                rep = _report(workdir, run_id, inst["instance_id"]) if c.diff else None
                ev = CandidateEvaluation(candidate=c, applied=bool(rep and rep.get("patch_successfully_applied")))
                resolved = bool(rep and rep.get("resolved"))
                if ev.applied:
                    st = rep.get("tests_status", {}).get("FAIL_TO_PASS", {})
                    ok = set(st.get("success", []))
                    ev.fail_to_pass = {t: t in ok for t in task.failing_tests}  # visible only
                    paths = diff_stats(c.diff).paths
                    ws.reset()
                    ev.static_before, _ = analyze_files(ws.root, paths)
                    if ws.apply_diff(c.diff)[0]:
                        ev.static_after, syn = analyze_files(ws.root, paths)
                        ev.syntax_error = syn > 0
                    ev.touches_protected = touches_protected(c.diff, task.protected_globs)
                    ev.normalized_diff = normalized_diff(c.diff)
                    ev.behavior_signature = "".join("1" if ev.fail_to_pass[t] else "0" for t in task.failing_tests)
                evals.append(ev)
                labels.append(resolved)
        compute_features(task, evals)
        records.append({"task_id": inst["instance_id"], "dataset": "swebench-lite", "simulated": False,
                        "failing_tests": task.failing_tests,
                        "candidates": [{"candidate_id": e.candidate.candidate_id, "generator": e.candidate.generator,
                                        "features": e.features, "gates": e.gate_failures, "wrong": not lab,
                                        "cost_usd": e.candidate.cost_usd, "diff_hash": ""}
                                       for e, lab in zip(evals, labels)]})
        log(f"{inst['instance_id']}: {sum(labels)}/{len(labels)} candidates resolve the issue")
    rec_io.save(out, records)
