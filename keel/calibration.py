"""Calibration artefact: the fitted scorer plus held-out (score, wrong) pairs.

Thresholds are recomputed on demand for any alpha, which is what the risk slider needs.
A fingerprint of the models, prompts and scorer is stored; a pipeline whose fingerprint
differs must not use this calibration to auto-merge (exchangeability would be broken).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

from . import conformal
from .context import ATTACK_SYSTEM, REPAIR_SYSTEM
from .scoring import SCORER_VERSION, Scorer

PROMPT_VERSION = hashlib.sha256((REPAIR_SYSTEM + ATTACK_SYSTEM).encode()).hexdigest()[:12]


def fingerprint(generators: dict[str, str], k: int, attack: bool, triage: bool = False) -> str:
    """generators: name -> model id."""
    payload = json.dumps({"gen": sorted(generators.items()), "k": k, "attack": attack, "triage": triage,
                          "prompt": PROMPT_VERSION, "scorer": SCORER_VERSION}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


@dataclass
class Calibration:
    scorer: Scorer
    scores: list[float]
    wrong: list[bool]
    fingerprint: str
    source: str = ""          # e.g. "quixbugs", "swebench-lite", "simulated"
    simulated: bool = False
    notes: str = ""
    task_ids: list[str] = field(default_factory=list)

    @property
    def n(self) -> int:
        return len(self.scores)

    def threshold(self, alpha: float, method: str = "crc", delta: float = 0.1) -> float:
        return conformal.threshold(method, self.scores, self.wrong, alpha, delta)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["scorer"] = self.scorer.to_dict()
        return d

    def save(self, path: str | Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(self.to_dict(), indent=1))

    @classmethod
    def load(cls, path: str | Path) -> "Calibration":
        d = json.loads(Path(path).read_text())
        d["scorer"] = Scorer.from_dict(d["scorer"])
        return cls(**d)
