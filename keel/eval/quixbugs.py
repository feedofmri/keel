"""QuixBugs (Python) as Keel tasks, with a visible/hidden test split.

QuixBugs (Lin et al., 2017; MIT license) has 40 small programs with one bug each and a
correct reference version. It is cloned at run time and never redistributed.

For each program we build a tiny repository containing the buggy program and a *visible*
subset of its tests. The *hidden* set (all test cases on which the reference passes) is
kept outside the repository and only used to label a candidate patch correct or wrong.
"""

from __future__ import annotations

import ast
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from ..testing import run_tests
from ..types import BugTask

REPO_URL = "https://github.com/jkoppel/QuixBugs"
TEST_COMMAND = "{python} -m pytest -q -p no:cacheprovider --timeout=3 {tests} --junitxml={junit}"

CONFTEST = '''import pytest


def pytest_configure(config):
    pytest.use_correct = False
    pytest.run_slow = False
'''

LOAD_TESTDATA = '''import json
from pathlib import Path


def load_json_testcases(algorithm):
    path = Path(__file__).parent / "json_testcases" / f"{algorithm}.json"
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]
'''


@dataclass
class QuixTask:
    name: str
    repo: Path          # visible repository given to Keel
    hidden: Path        # directory holding the hidden test files (same relative layout)
    kind: str           # "json" or "functions"
    n_visible: int
    n_hidden: int

    def bug_task(self) -> BugTask:
        return BugTask(task_id=f"quixbugs/{self.name}", repo_path=str(self.repo), test_command=TEST_COMMAND,
                       test_timeout=120)


def fetch(cache: Path) -> Path:
    dest = cache / "QuixBugs"
    if not (dest / "python_programs").exists():
        cache.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", REPO_URL, str(dest)], check=True)
    return dest


def _write_repo(root: Path, src: Path, name: str, program: Path, test_src: str, cases: list[str] | None) -> None:
    if root.exists():
        shutil.rmtree(root)
    (root / "python_programs").mkdir(parents=True)
    (root / "tests").mkdir()
    shutil.copy(program, root / "python_programs" / f"{name}.py")
    (root / "conftest.py").write_text(CONFTEST)
    (root / "load_testdata.py").write_text(LOAD_TESTDATA)
    node = src / "python_testcases" / "node.py"
    if node.exists():
        shutil.copy(node, root / "node.py")
    (root / "tests" / f"test_{name}.py").write_text(test_src)
    if cases is not None:
        (root / "json_testcases").mkdir()
        (root / "json_testcases" / f"{name}.json").write_text("\n".join(cases) + "\n")
    (root / "pyproject.toml").write_text('[tool.pytest.ini_options]\npythonpath = ["."]\n')


def _drop_functions(src: str, keep: set[str]) -> str:
    """Remove top-level test functions not in `keep`."""
    tree = ast.parse(src)
    lines = src.splitlines(keepends=True)
    remove: list[tuple[int, int]] = []
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name.startswith("test") and node.name not in keep:
            start = min([d.lineno for d in node.decorator_list] + [node.lineno]) - 1
            remove.append((start, node.end_lineno))
    for a, b in sorted(remove, reverse=True):
        del lines[a:b]
    return "".join(lines)


def _probe(root: Path) -> dict[str, bool]:
    return run_tests(root, [], TEST_COMMAND, timeout=300).results


_CASE_RE = re.compile(r"\[input_data(\d+)-")


def build_task(src: Path, name: str, work: Path) -> QuixTask | None:
    test_file = src / "python_testcases" / f"test_{name}.py"
    buggy = src / "python_programs" / f"{name}.py"
    correct = src / "correct_python_programs" / f"{name}.py"
    if not (test_file.exists() and buggy.exists() and correct.exists()):
        return None
    test_src = test_file.read_text()
    json_file = src / "json_testcases" / f"{name}.json"
    probe = work / "_probe" / name
    if "load_json_testcases" in test_src and json_file.exists():
        cases = [ln for ln in json_file.read_text().splitlines() if ln.strip()]
        status = {}
        for label, prog in (("buggy", buggy), ("correct", correct)):
            _write_repo(probe, src, name, prog, test_src, cases)
            res = _probe(probe)
            status[label] = {int(m.group(1)): ok for k, ok in res.items() if (m := _CASE_RE.search(k))}
        keep = [i for i in range(len(cases)) if status["correct"].get(i)]
        failing = [i for i in keep if not status["buggy"].get(i, False)]
        if not keep or not failing:
            return None
        visible = sorted(set(keep[::2]) | {failing[0]})
        repo, hidden = work / "tasks" / name, work / "hidden" / name
        _write_repo(repo, src, name, buggy, test_src, [cases[i] for i in visible])
        _write_repo(hidden, src, name, buggy, test_src, [cases[i] for i in keep])
        kind, nv, nh = "json", len(visible), len(keep)
    else:
        fnames = [n.name for n in ast.parse(test_src).body
                  if isinstance(n, ast.FunctionDef) and n.name.startswith("test")]
        status = {}
        for label, prog in (("buggy", buggy), ("correct", correct)):
            _write_repo(probe, src, name, prog, test_src, None)
            res = _probe(probe)
            status[label] = {k.rsplit(".", 1)[-1]: ok for k, ok in res.items()}
        keep = [f for f in fnames if status["correct"].get(f)]
        failing = [f for f in keep if not status["buggy"].get(f, False)]
        if not keep or not failing:
            return None
        visible = set(keep[::2]) | {failing[0]}
        repo, hidden = work / "tasks" / name, work / "hidden" / name
        _write_repo(repo, src, name, buggy, _drop_functions(test_src, visible), None)
        _write_repo(hidden, src, name, buggy, _drop_functions(test_src, set(keep)), None)
        kind, nv, nh = "functions", len(visible), len(keep)
    shutil.rmtree(probe, ignore_errors=True)
    # The hidden directory only needs the test files; drop the buggy program copy.
    shutil.rmtree(hidden / "python_programs", ignore_errors=True)
    return QuixTask(name=name, repo=repo, hidden=hidden, kind=kind, n_visible=nv, n_hidden=nh)


def build_all(cache: Path, work: Path, names: list[str] | None = None, log=print) -> list[QuixTask]:
    src = fetch(cache)
    all_names = sorted(p.stem[5:] for p in (src / "python_testcases").glob("test_*.py"))
    tasks = []
    for name in names or all_names:
        t = build_task(src, name, work)
        log(f"quixbugs: {name}: " + (f"{t.n_visible}/{t.n_hidden} visible/hidden tests" if t else "skipped"))
        if t:
            tasks.append(t)
    (work / "tasks.json").write_text(json.dumps([{**t.__dict__, "repo": str(t.repo), "hidden": str(t.hidden)}
                                                 for t in tasks], indent=1))
    return tasks


def load_tasks(work: Path) -> list[QuixTask]:
    data = json.loads((work / "tasks.json").read_text())
    return [QuixTask(**{**d, "repo": Path(d["repo"]), "hidden": Path(d["hidden"])}) for d in data]


def hidden_label(task: QuixTask, workspace_root: Path) -> bool:
    """True if the patched workspace passes every hidden test (i.e. the patch is correct)."""
    for f in task.hidden.rglob("*"):
        if f.is_file():
            dest = workspace_root / f.relative_to(task.hidden)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(f, dest)
    res = run_tests(workspace_root, [], TEST_COMMAND, timeout=300).results
    return len(res) >= task.n_hidden and all(res.values())


if __name__ == "__main__":  # pragma: no cover
    build_all(Path(sys.argv[1]), Path(sys.argv[2]))
