"""Adversarial tests: a Meta model writes new tests aimed at where candidate patches differ.

Generated tests are untrusted. They are used only as *features* (does a patch survive
them, does it disagree with its peers), never as correctness labels.
"""

from __future__ import annotations

import ast
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from .context import attack_messages, test_files_for
from .generators import Generator
from .types import BugTask

# A reply cut off by the token limit can lose its closing fence, so the end of the text also closes a block.
_PY_FENCE = re.compile(r"```(?:python|py)?[ \t]*\n(.*?)(?:```|\Z)", re.DOTALL)


@dataclass
class AttackSuite:
    relpath: str        # where the file goes inside a workspace
    source: str
    test_ids: list[str]
    cost_usd: float = 0.0

    def install(self, root: Path) -> None:
        target = root / self.relpath
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.source)


def extract_tests(text: str) -> str | None:
    blocks = _PY_FENCE.findall(text)
    src = max(blocks, key=len) if blocks else text
    try:
        ast.parse(src)
    except SyntaxError:
        return None
    return src


def test_names(src: str) -> list[str]:
    """pytest node names: top-level test functions and test methods of Test* classes."""
    names: list[str] = []
    for n in ast.parse(src).body:
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name.startswith("test"):
            names.append(n.name)
        elif isinstance(n, ast.ClassDef) and n.name.startswith("Test"):
            names += [f"{n.name}::{m.name}" for m in n.body
                      if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and m.name.startswith("test")]
    return names


def build_attack_suite(task: BugTask, root: Path, diffs: list[str], generator: Generator,
                       seed: int = 0, log=lambda m: None) -> AttackSuite | None:
    unique = list(dict.fromkeys(d for d in diffs if d.strip()))
    if not unique:
        return None
    comps = generator.complete(attack_messages(task, root, unique), n=1, temperature=0.2, seed=seed,
                               max_tokens=8192)
    if not comps or comps[0].error:
        log(f"attack: the model call failed ({comps[0].error if comps else 'no reply'})")
        return None
    src = extract_tests(comps[0].text)
    if not src:
        log(f"attack: the reply had no valid Python test code ({len(comps[0].text)} characters)")
        return None
    names = test_names(src)
    if not names:
        log("attack: the reply's code defined no test functions")
        return None
    tfs = test_files_for(task)
    folder = str(Path(tfs[0]).parent) if tfs else "tests"
    tag = hashlib.sha256(src.encode()).hexdigest()[:8]
    rel = f"{folder}/test_keel_attack_{tag}.py" if folder != "." else f"test_keel_attack_{tag}.py"
    return AttackSuite(relpath=rel, source=src, test_ids=[f"{rel}::{n}" for n in names],
                       cost_usd=comps[0].cost_usd)
