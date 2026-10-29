"""Prompt construction: repair, adversarial test-writing, triage, explanation."""

from __future__ import annotations

import os
from pathlib import Path

from .sandbox import is_protected
from .types import BugTask

MAX_FILE_LINES = 400
WINDOW = 60
MAX_FAILURE_CHARS = 6000
MAX_CONTEXT_CHARS = 60000

REPAIR_SYSTEM = """You are Keel, a careful senior software engineer repairing a failing test suite.
Rules:
- Fix the root cause in the source code. NEVER modify tests, test fixtures, CI config or .keel.toml.
- Make the smallest change that fixes the bug; do not refactor or reformat unrelated code.
- Output every change as one or more SEARCH/REPLACE blocks in exactly this format:

path/to/file.py
<<<<<<< SEARCH
exact lines copied from the current file
=======
replacement lines
>>>>>>> REPLACE

- SEARCH must match the file exactly (including indentation) and be unique in the file.
- After the blocks, write one line: CONFIDENCE: <number between 0 and 1> that the fix is fully correct.
"""

ATTACK_SYSTEM = """You are an adversarial QA engineer. Several engineers proposed different patches for the
same bug. Your job is to write NEW pytest tests that pin down the intended behaviour described in the
issue and the existing tests, especially edge cases where the proposed patches might differ or be wrong.
Rules:
- Test the public behaviour only; do not depend on implementation details of any one patch.
- Every test must pass on a fully correct fix.
- Output ONE python file in a ```python fenced block. Name test functions test_attack_1, test_attack_2, ...
- Write between 4 and 10 tests. Import the code under test the same way the existing tests do.
"""

TRIAGE_SYSTEM = """You estimate how hard a bug is to fix from its failing tests and traceback.
Answer with exactly one word: easy, medium or hard."""

EXPLAIN_SYSTEM = """You write short, plain-English explanations for code reviewers. Given the decision of an
automated repair system and the evidence behind it, write 2-3 sentences explaining why the patch was
auto-merged or why it needs human review. Be concrete; do not invent facts not in the evidence."""


def _read(root: Path, rel: str) -> list[str]:
    try:
        return (root / rel).read_text(errors="replace").splitlines()
    except OSError:
        return []


def _numbered(lines: list[str], start: int, end: int) -> str:
    return "\n".join(f"{i + 1:5d} | {lines[i]}" for i in range(max(0, start), min(len(lines), end)))


def test_files_for(task: BugTask) -> list[str]:
    files = []
    for t in task.failing_tests:
        f = t.split("::")[0]
        if f.endswith(".py") and f not in files:
            files.append(f)
    return files


def source_snippets(task: BugTask, root: Path) -> list[tuple[str, str]]:
    """(path, numbered text) for non-test files implicated by the traceback."""
    by_file: dict[str, list[int]] = {}
    for loc in task.suspicious_locations:
        if is_protected(loc.path, task.protected_globs):
            continue
        by_file.setdefault(loc.path, []).append(loc.line)
    if not by_file:
        # Fall back to modules imported by the failing tests.
        for tf in test_files_for(task):
            for line in _read(root, tf):
                s = line.strip()
                if s.startswith(("from ", "import ")):
                    mod = s.split()[1].split(".")[0]
                    for cand in (f"{mod}.py", f"{mod}/__init__.py", f"src/{mod}.py"):
                        if (root / cand).is_file():
                            by_file.setdefault(cand, [])
    out = []
    for path, lines in by_file.items():
        src = _read(root, path)
        if len(src) <= MAX_FILE_LINES or not lines:
            out.append((path, _numbered(src, 0, MAX_FILE_LINES)))
        else:
            chunks = []
            for ln in sorted(set(lines)):
                chunks.append(_numbered(src, ln - WINDOW, ln + WINDOW))
            out.append((path, "\n   ...\n".join(chunks)))
    return out


def repo_listing(root: Path, limit: int = 200) -> str:
    files = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if not d.startswith(".") and d not in ("node_modules", "__pycache__")]
        for fn in fns:
            if fn.endswith(".py"):
                files.append(os.path.relpath(os.path.join(dp, fn), root))
    files.sort()
    return "\n".join(files[:limit])


def repair_messages(task: BugTask, root: Path) -> list[dict[str, str]]:
    parts = []
    if task.problem_statement:
        parts.append(f"## Issue\n{task.problem_statement.strip()}")
    parts.append("## Failing tests\n" + "\n".join(f"- {t}" for t in task.failing_tests))
    parts.append(f"## Test output\n```\n{task.failure_output[-MAX_FAILURE_CHARS:]}\n```")
    for tf in test_files_for(task):
        src = _read(root, tf)
        parts.append(f"## Test file (read-only): {tf}\n```python\n{_numbered(src, 0, MAX_FILE_LINES)}\n```")
    for path, text in source_snippets(task, root):
        parts.append(f"## Source: {path} (line numbers are for reference only, do not include them)\n"
                     f"```python\n{text}\n```")
    parts.append(f"## Python files in the repository\n{repo_listing(root)}")
    user = "\n\n".join(parts)[:MAX_CONTEXT_CHARS]
    return [{"role": "system", "content": REPAIR_SYSTEM}, {"role": "user", "content": user}]


def attack_messages(task: BugTask, root: Path, diffs: list[str]) -> list[dict[str, str]]:
    parts = []
    if task.problem_statement:
        parts.append(f"## Issue\n{task.problem_statement.strip()}")
    for tf in test_files_for(task):
        parts.append(f"## Existing tests: {tf}\n```python\n" + "\n".join(_read(root, tf)[:MAX_FILE_LINES]) + "\n```")
    for path, text in source_snippets(task, root):
        parts.append(f"## Source before the fix: {path}\n```python\n{text}\n```")
    for i, d in enumerate(diffs[:6], 1):
        parts.append(f"## Proposed patch {i}\n```diff\n{d[:4000]}\n```")
    user = "\n\n".join(parts)[:MAX_CONTEXT_CHARS]
    return [{"role": "system", "content": ATTACK_SYSTEM}, {"role": "user", "content": user}]


def triage_messages(task: BugTask) -> list[dict[str, str]]:
    user = ("Failing tests:\n" + "\n".join(task.failing_tests) +
            f"\n\nOutput:\n{task.failure_output[-3000:]}")
    return [{"role": "system", "content": TRIAGE_SYSTEM}, {"role": "user", "content": user}]


def explain_messages(label: str, reasons: list[str], guarantee: str) -> list[dict[str, str]]:
    user = f"Decision: {label}\nEvidence:\n" + "\n".join(f"- {r}" for r in reasons) + f"\nGuarantee: {guarantee}"
    return [{"role": "system", "content": EXPLAIN_SYSTEM}, {"role": "user", "content": user}]
