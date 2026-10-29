"""Isolated workspaces in which candidate patches are applied and tested."""

from __future__ import annotations

import fnmatch
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from .diffutil import diff_stats

_IGNORE = shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache", "*.pyc", ".venv",
                                 "node_modules", ".keel-cache")
_GIT_ENV = {"GIT_AUTHOR_NAME": "keel", "GIT_AUTHOR_EMAIL": "keel@localhost",
            "GIT_COMMITTER_NAME": "keel", "GIT_COMMITTER_EMAIL": "keel@localhost"}


def git(cwd: Path, *args: str, check: bool = True, input: str | None = None) -> subprocess.CompletedProcess:
    env = dict(os.environ, **_GIT_ENV)
    return subprocess.run(["git", *args], cwd=cwd, check=check, capture_output=True, text=True,
                          input=input, env=env)


class Workspace:
    """A throwaway copy of a repository with its own private git history.

    The copy gets a fresh git repository so `git diff` yields a clean unified diff of
    whatever changed, independent of the source repo's VCS state.
    """

    def __init__(self, source: str | Path):
        self.source = Path(source)
        self._tmp = tempfile.mkdtemp(prefix="keel-ws-")
        self.root = Path(self._tmp) / "repo"
        shutil.copytree(self.source, self.root, ignore=_IGNORE, symlinks=True)
        git(self.root, "init", "-q")
        (self.root / ".git" / "info").mkdir(parents=True, exist_ok=True)
        (self.root / ".git" / "info" / "exclude").write_text(
            "__pycache__/\n*.pyc\n.pytest_cache/\n.keel-junit.xml\n")
        git(self.root, "add", "-A")
        git(self.root, "commit", "-q", "--allow-empty", "--no-verify", "-m", "base")

    def __enter__(self) -> "Workspace":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def close(self) -> None:
        shutil.rmtree(self._tmp, ignore_errors=True)

    def apply_diff(self, diff: str) -> tuple[bool, str]:
        if not diff.strip():
            return False, "empty diff"
        if not diff.endswith("\n"):
            diff += "\n"
        err = ""
        for args in (["apply", "--whitespace=nowarn"],
                     ["apply", "--whitespace=nowarn", "--recount", "-C1"]):
            r = git(self.root, *args, "-", check=False, input=diff)
            if r.returncode == 0:
                return True, ""
            err = r.stderr.strip()
        return False, err

    def diff(self) -> str:
        git(self.root, "add", "-A")
        return git(self.root, "diff", "--cached", "--no-color", "HEAD").stdout

    def reset(self) -> None:
        git(self.root, "reset", "-q", "--hard", "HEAD")
        git(self.root, "clean", "-qfd")


def is_protected(path: str, protected_globs: list[str]) -> bool:
    name = os.path.basename(path)
    return any(fnmatch.fnmatch(path, g) or fnmatch.fnmatch(name, g) for g in protected_globs)


def touches_protected(diff: str, protected_globs: list[str]) -> bool:
    return any(is_protected(p, protected_globs) for p in diff_stats(diff).paths)
