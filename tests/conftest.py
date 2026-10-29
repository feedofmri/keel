from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def demo_repo() -> Path:
    return ROOT / "examples" / "demo_repo"


@pytest.fixture
def responses() -> Path:
    return ROOT / "examples" / "responses"
