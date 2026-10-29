from pathlib import Path

import pytest

from keel.diffutil import diff_stats, normalized_diff
from keel.edits import EditError, apply_edits, parse_confidence, parse_edits
from keel.sandbox import Workspace, touches_protected

RESPONSE = """Fix:

pkg/mod.py
<<<<<<< SEARCH
    return a - b
=======
    return a + b
>>>>>>> REPLACE

CONFIDENCE: 0.8
"""


def _repo(tmp_path: Path) -> Path:
    (tmp_path / "pkg").mkdir()
    (tmp_path / "pkg" / "mod.py").write_text("def add(a, b):\n    return a - b\n")
    return tmp_path


def test_parse_and_apply(tmp_path):
    edits = parse_edits(RESPONSE)
    assert len(edits) == 1 and edits[0].path == "pkg/mod.py"
    assert parse_confidence(RESPONSE) == 0.8
    with Workspace(_repo(tmp_path)) as ws:
        apply_edits(ws.root, edits)
        diff = ws.diff()
    st = diff_stats(diff)
    assert st.files == 1 and st.added == 1 and st.removed == 1 and st.paths == ["pkg/mod.py"]


def test_fuzzy_indentation(tmp_path):
    text = RESPONSE.replace("    return a - b", "return a - b").replace("    return a + b", "return a + b")
    with Workspace(_repo(tmp_path)) as ws:
        apply_edits(ws.root, parse_edits(text))
        assert "    return a + b" in (ws.root / "pkg" / "mod.py").read_text()


def test_path_escape_rejected(tmp_path):
    bad = RESPONSE.replace("pkg/mod.py", "../outside.py")
    with Workspace(_repo(tmp_path)) as ws, pytest.raises(EditError):
        apply_edits(ws.root, parse_edits(bad))


def test_missing_search_rejected(tmp_path):
    bad = RESPONSE.replace("return a - b\n=", "return nothing\n=")
    with Workspace(_repo(tmp_path)) as ws, pytest.raises(EditError):
        apply_edits(ws.root, parse_edits(bad))


def test_normalized_diff_ignores_cosmetics():
    a = "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-x = 1\n+x = \"a\"  # note\n"
    b = "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-x = 1\n+x='a'\n"
    assert normalized_diff(a) == normalized_diff(b)


def test_protected_paths():
    d = "--- a/tests/test_x.py\n+++ b/tests/test_x.py\n@@ -1 +1 @@\n-a\n+b\n"
    assert touches_protected(d, ["tests/*"])
    assert not touches_protected(d.replace("tests/test_x.py", "src/x.py"), ["tests/*", "test_*.py"])
