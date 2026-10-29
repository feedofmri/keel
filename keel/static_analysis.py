"""Static-analysis deltas: does a patch introduce new warnings or syntax errors?"""

from __future__ import annotations

import ast
from pathlib import Path

from pyflakes import api as pyflakes_api
from pyflakes import reporter as pyflakes_reporter


class _Counter(pyflakes_reporter.Reporter):
    def __init__(self) -> None:
        self.warnings = 0
        self.syntax_errors = 0

    def unexpectedError(self, filename, msg):  # noqa: N802 (pyflakes API)
        self.syntax_errors += 1

    def syntaxError(self, filename, msg, lineno, offset, text):  # noqa: N802
        self.syntax_errors += 1

    def flake(self, message):
        self.warnings += 1


def analyze_files(root: Path, paths: list[str]) -> tuple[int, int]:
    """Return (warning_count, syntax_error_count) over the given Python files."""
    c = _Counter()
    for p in paths:
        f = root / p
        if not p.endswith(".py") or not f.exists():
            continue
        src = f.read_text(errors="replace")
        try:
            ast.parse(src)
        except SyntaxError:
            c.syntax_errors += 1
            continue
        pyflakes_api.check(src, str(f), c)
    return c.warnings, c.syntax_errors
