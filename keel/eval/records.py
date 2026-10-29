"""Bug records: every candidate's features plus its hidden-test correctness label.

One JSON object per line:
{"task_id": ..., "dataset": ..., "simulated": false,
 "candidates": [{"candidate_id", "generator", "features": {...}, "gates": [...],
                 "wrong": bool, "cost_usd": float, "diff_hash": str}]}
"""

from __future__ import annotations

import json
from pathlib import Path


def load(path: str | Path) -> list[dict]:
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def save(path: str | Path, records: list[dict]) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")


def append(path: str | Path, record: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(record) + "\n")


def restrict(records: list[dict], generators: set[str]) -> list[dict]:
    """Keep only candidates from the given generators (bugs with none left are dropped)."""
    out = []
    for r in records:
        cs = [c for c in r["candidates"] if c["generator"] in generators]
        if cs:
            out.append({**r, "candidates": cs})
    return out
