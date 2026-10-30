"""A model named in the settings but without credentials is skipped rather than crashing the run."""

import pytest

from keel.cli import build_pipeline
from keel.config import KeelConfig


def _clear(monkeypatch):
    for prefix in ("KEEL_MUSE_SPARK", "KEEL_SPARK_OPEN", "KEEL_GLIMMER"):
        for suffix in ("BASE_URL", "API_KEY", "MODEL"):
            monkeypatch.delenv(f"{prefix}_{suffix}", raising=False)


def test_unconfigured_model_is_skipped(monkeypatch):
    _clear(monkeypatch)
    for k, v in {"BASE_URL": "https://api.example/v1", "API_KEY": "k", "MODEL": "muse-spark-1.3"}.items():
        monkeypatch.setenv(f"KEEL_MUSE_SPARK_{k}", v)
    logs: list[str] = []
    pipe = build_pipeline(KeelConfig(), ["muse-spark", "muse-spark-open"], "muse-spark",
                          None, None, None, None, log=logs.append)
    assert [g.generator.name for g in pipe.generators] == ["muse-spark"]
    assert any("skipping muse-spark-open" in m for m in logs)


def test_attacker_without_credentials_is_disabled(monkeypatch):
    _clear(monkeypatch)
    for k, v in {"BASE_URL": "https://api.example/v1", "API_KEY": "k", "MODEL": "m"}.items():
        monkeypatch.setenv(f"KEEL_SPARK_OPEN_{k}", v)
    logs: list[str] = []
    pipe = build_pipeline(KeelConfig(), ["muse-spark-open"], "muse-spark", None, None, None, None, log=logs.append)
    assert pipe.attacker is None
    assert any("adversarial tests disabled" in m for m in logs)


def test_no_configured_model_fails_clearly(monkeypatch):
    _clear(monkeypatch)
    with pytest.raises(RuntimeError, match="no configured model"):
        build_pipeline(KeelConfig(), ["muse-spark"], None, None, None, None, None, log=lambda m: None)
