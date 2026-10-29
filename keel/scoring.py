"""The nonconformity score: hard gates plus a logistic model over code-aware features.

s(x) = 1 if any gate fails, else 1 - sigmoid(w . z + b), where z are standardised features.
Lower is more trustworthy. The conformal guarantee only requires s to be a fixed function
chosen before calibration, so the model is fit on a split disjoint from calibration.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np

from .features import FEATURE_NAMES

SCORER_VERSION = "1"

# Hand-set prior used before any data is available (signs reflect domain knowledge).
PRIOR_WEIGHTS = {
    "attack_survival": 1.2, "attack_minority": -0.8,
    "log_diff_size": -0.5, "n_files": -0.3, "n_hunks": -0.2,
    "frac_files_in_traceback": 0.4, "log_line_distance": -0.3,
    "static_delta": -0.6,
    "exact_agreement": 0.6, "behavior_agreement": 0.8, "mean_jaccard": 0.4, "cross_model_agreement": 0.6,
    "mean_logprob": 0.3, "min_logprob": 0.2, "log_reasoning_tokens": -0.1,
    "self_confidence": 0.2,
}

# Typical (centre, spread) of each feature, so the prior's contributions read sensibly.
PRIOR_SCALE = {
    "attack_survival": (0.7, 0.3), "attack_minority": (0.1, 0.2),
    "log_diff_size": (2.5, 1.0), "n_files": (1.5, 1.0), "n_hunks": (2.0, 1.5),
    "frac_files_in_traceback": (0.5, 0.5), "log_line_distance": (2.5, 1.5),
    "static_delta": (0.0, 1.0),
    "exact_agreement": (0.2, 0.25), "behavior_agreement": (0.5, 0.3), "mean_jaccard": (0.4, 0.25),
    "cross_model_agreement": (0.4, 0.3),
    "mean_logprob": (-0.3, 0.3), "min_logprob": (-6.0, 3.0), "log_reasoning_tokens": (6.0, 1.5),
    "self_confidence": (0.7, 0.2),
}


@dataclass
class Scorer:
    feature_names: list[str] = field(default_factory=lambda: list(FEATURE_NAMES))
    weights: list[float] = field(default_factory=lambda: [PRIOR_WEIGHTS.get(f, 0.0) for f in FEATURE_NAMES])
    bias: float = 0.5
    means: list[float] = field(default_factory=lambda: [PRIOR_SCALE.get(f, (0.0, 1.0))[0] for f in FEATURE_NAMES])
    stds: list[float] = field(default_factory=lambda: [PRIOR_SCALE.get(f, (0.0, 1.0))[1] for f in FEATURE_NAMES])
    version: str = SCORER_VERSION
    fitted: bool = False

    def _z(self, feats: dict[str, float]) -> np.ndarray:
        x = np.array([feats.get(f, 0.0) for f in self.feature_names], dtype=float)
        return (x - np.array(self.means)) / np.array(self.stds)

    def prob_correct(self, feats: dict[str, float]) -> float:
        z = float(np.dot(self._z(feats), self.weights) + self.bias)
        return 1.0 / (1.0 + math.exp(-max(min(z, 50.0), -50.0)))

    def score(self, feats: dict[str, float], gates: list[str]) -> float:
        if gates:
            return 1.0
        return 1.0 - self.prob_correct(feats)

    def contributions(self, feats: dict[str, float]) -> dict[str, float]:
        """Per-feature contribution to the log-odds of being correct."""
        z = self._z(feats)
        return {f: float(w * zi) for f, w, zi in zip(self.feature_names, self.weights, z)}

    def fit(self, X: list[dict[str, float]], y: list[int], l2: float = 1.0, iters: int = 2000,
            lr: float = 0.1) -> "Scorer":
        """L2-regularised logistic regression (y=1 means correct) by gradient descent."""
        A = np.array([[x.get(f, 0.0) for f in self.feature_names] for x in X], dtype=float)
        t = np.array(y, dtype=float)
        if len(A) == 0 or t.min() == t.max():
            return self  # not enough signal: keep the prior
        mu = A.mean(axis=0)
        sd = A.std(axis=0)
        sd[sd < 1e-9] = 1.0
        Z = (A - mu) / sd
        w = np.zeros(Z.shape[1])
        b = math.log((t.mean() + 1e-6) / (1 - t.mean() + 1e-6))
        n = len(t)
        for _ in range(iters):
            p = 1.0 / (1.0 + np.exp(-(Z @ w + b)))
            g = p - t
            w -= lr * (Z.T @ g / n + l2 * w / n)
            b -= lr * g.mean()
        self.weights, self.bias = w.tolist(), float(b)
        self.means, self.stds = mu.tolist(), sd.tolist()
        self.fitted = True
        return self

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Scorer":
        return cls(**d)

    def save(self, path: str | Path) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, path: str | Path) -> "Scorer":
        return cls.from_dict(json.loads(Path(path).read_text()))
