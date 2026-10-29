"""Repository configuration (`.keel.toml`) with defaults."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from .types import DEFAULT_PROTECTED, DEFAULT_TEST_COMMAND


@dataclass
class KeelConfig:
    test_command: str = DEFAULT_TEST_COMMAND
    test_timeout: int = 300
    protected_globs: list[str] = field(default_factory=lambda: list(DEFAULT_PROTECTED))
    alpha: float = 0.1
    method: str = "crc"           # crc | ltt
    delta: float = 0.1
    k: int = 5
    temperature: float = 0.8
    models: list[str] = field(default_factory=lambda: ["muse-spark", "muse-spark-open"])
    attacker: str | None = "muse-spark"
    triage: str | None = None     # e.g. "muse-glimmer"
    explainer: str | None = None  # e.g. "muse-spark"
    calibration: str | None = None
    enable_auto_merge: bool = False
    labels: dict[str, str] = field(default_factory=lambda: {"AUTO-MERGE": "0e8a16", "NEEDS REVIEW": "fbca04"})

    @classmethod
    def load(cls, repo: str | Path) -> "KeelConfig":
        path = Path(repo) / ".keel.toml"
        cfg = cls()
        if not path.exists():
            return cfg
        data = tomllib.loads(path.read_text())
        data = data.get("keel", data)
        for k, v in data.items():
            if hasattr(cfg, k):
                setattr(cfg, k, v)
        if cfg.method not in ("crc", "ltt"):
            raise ValueError(f".keel.toml: method must be 'crc' or 'ltt', got {cfg.method!r}")
        if not 0 < cfg.alpha < 1:
            raise ValueError(".keel.toml: alpha must be in (0, 1)")
        return cfg
