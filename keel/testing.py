"""Running tests (sandboxed) and extracting failure locations."""

from __future__ import annotations

import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from .types import Location, TestOutcome

# Environment variables never passed to code under test (it is untrusted: a model wrote it).
_SECRET_RE = re.compile(r"(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)", re.IGNORECASE)


def scrubbed_env(extra_path: Path | None = None) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not _SECRET_RE.search(k)}
    env.update(PYTHONDONTWRITEBYTECODE="1", PYTHONHASHSEED="0")
    if extra_path is not None:
        env["PYTHONPATH"] = str(extra_path) + os.pathsep + env.get("PYTHONPATH", "")
    return env


def _isolate(cmd: str, root: Path) -> str:
    """Optionally wrap a command so it runs without network access.

    KEEL_TEST_ISOLATION = none (default) | unshare | docker
    """
    mode = os.environ.get("KEEL_TEST_ISOLATION", "none")
    if mode == "unshare" and shutil.which("unshare"):
        return f"unshare -rn sh -c {shlex.quote(cmd)}"
    if mode == "docker" and shutil.which("docker"):
        image = os.environ.get("KEEL_TEST_IMAGE", "python:3.12-slim")
        return (f"docker run --rm --network none -v {shlex.quote(str(root))}:{shlex.quote(str(root))} "
                f"-w {shlex.quote(str(root))} {shlex.quote(image)} sh -c {shlex.quote(cmd)}")
    return cmd


def norm_test_id(test_id: str) -> str:
    """Map a pytest node id or a junit classname.name to one comparable form."""
    t = test_id.strip()
    t = t.replace("::", ".").replace("/", ".").replace("\\", ".")
    t = re.sub(r"\.py(?=\.|\[|$)", "", t)
    return t


def parse_junit(path: Path) -> dict[str, bool]:
    results: dict[str, bool] = {}
    if not path.exists() or path.stat().st_size == 0:
        return results
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return results
    for case in root.iter("testcase"):
        cls = case.get("classname", "")
        name = case.get("name", "")
        tid = f"{cls}.{name}" if cls else name
        failed = any(child.tag in ("failure", "error") for child in case)
        skipped = any(child.tag == "skipped" for child in case)
        results[norm_test_id(tid)] = not failed and not skipped
    return results


def run_tests(root: Path, tests: list[str], command: str, timeout: int = 300) -> TestOutcome:
    """Run `tests` (or the whole suite if empty) and return per-test pass/fail."""
    with tempfile.TemporaryDirectory(prefix="keel-junit-") as tmp:
        junit = Path(tmp) / "junit.xml"
        test_args = " ".join(shlex.quote(t) for t in tests)
        python = "python" if os.environ.get("KEEL_TEST_ISOLATION") == "docker" else sys.executable
        cmd = command.format(tests=test_args, junit=shlex.quote(str(junit)), python=python)
        if os.environ.get("KEEL_TEST_ISOLATION") == "docker":
            # junit must be written inside the mounted repo for docker mode.
            junit = root / ".keel-junit.xml"
            cmd = command.format(tests=test_args, junit=shlex.quote(str(junit)), python=python)
        timed_out = False
        try:
            proc = subprocess.run(_isolate(cmd, root), shell=True, cwd=root, capture_output=True,
                                  text=True, timeout=timeout, env=scrubbed_env(root))
            output = proc.stdout + proc.stderr
        except subprocess.TimeoutExpired as e:
            out = e.stdout or ""
            output = out.decode(errors="replace") if isinstance(out, bytes) else out
            timed_out = True
        parsed = parse_junit(junit)
        if junit.parent == root:
            junit.unlink(missing_ok=True)

    results: dict[str, bool] = {}
    if tests:
        for t in tests:
            key = norm_test_id(t)
            if key in parsed:
                results[t] = parsed[key] and not timed_out
            else:
                hits = [v for k, v in parsed.items() if k.startswith(key + ".") or k.startswith(key + "[")]
                results[t] = bool(hits) and all(hits) and not timed_out
    else:
        results = dict(parsed)
    return TestOutcome(results=results, output=output[-20000:], timed_out=timed_out)


def collect_tests(root: Path, timeout: int = 120) -> list[str]:
    proc = subprocess.run([sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider"],
                          cwd=root, capture_output=True, text=True, timeout=timeout,
                          env=scrubbed_env(root))
    return [ln.strip() for ln in proc.stdout.splitlines() if "::" in ln and not ln.startswith(" ")]


_TB_RES = [
    re.compile(r'File "(?P<path>[^"]+)", line (?P<line>\d+)'),
    re.compile(r"^(?P<path>[\w./\\-]+\.py):(?P<line>\d+):", re.MULTILINE),
]


def extract_locations(output: str, root: Path) -> list[Location]:
    """Source locations inside the repo named in a traceback, most specific last."""
    seen: set[tuple[str, int]] = set()
    locs: list[Location] = []
    root_s = str(root.resolve())
    for rx in _TB_RES:
        for m in rx.finditer(output):
            p = m.group("path")
            if os.path.isabs(p):
                try:
                    rp = str(Path(p).resolve())
                except OSError:
                    continue
                if not rp.startswith(root_s + os.sep):
                    continue
                p = os.path.relpath(rp, root_s)
            if "site-packages" in p or p.startswith(".."):
                continue
            if not (root / p).is_file():
                continue
            key = (p, int(m.group("line")))
            if key not in seen:
                seen.add(key)
                locs.append(Location(path=p, line=key[1]))
    return locs


def locations_from_imports(root: Path, test_files: list[str]) -> list[Location]:
    """Definitions of the names a failing test imports (assertion failures have no source traceback)."""
    import ast

    locs: list[Location] = []
    for tf in test_files:
        try:
            tree = ast.parse((root / tf).read_text(errors="replace"))
        except (OSError, SyntaxError):
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom) or not node.module or node.level:
                continue
            base = node.module.replace(".", "/")
            for cand in (f"{base}.py", f"{base}/__init__.py", f"src/{base}.py"):
                f = root / cand
                if not f.is_file():
                    continue
                try:
                    mod = ast.parse(f.read_text(errors="replace"))
                except SyntaxError:
                    break
                wanted = {a.name for a in node.names}
                for d in mod.body:
                    if isinstance(d, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and d.name in wanted:
                        locs.append(Location(path=cand, line=d.lineno))
                break
    return locs
