"""Parse model output into edits and apply them to a workspace.

Models are asked for SEARCH/REPLACE blocks (more robust than raw unified diffs);
```diff blocks are accepted as a fallback. Either way the final artefact is a unified
diff produced by git, so everything downstream sees one format.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

_BLOCK_RE = re.compile(
    r"(?P<path>[^\n`]*?)\s*\n(?:```[a-zA-Z]*\s*\n)?<<<<<<< SEARCH\n(?P<search>.*?)\n?=======\n"
    r"(?P<replace>.*?)\n?>>>>>>> REPLACE",
    re.DOTALL,
)
_DIFF_FENCE_RE = re.compile(r"```(?:diff|patch)\n(.*?)```", re.DOTALL)
_CONF_RE = re.compile(r"CONFIDENCE:\s*\**\s*([01](?:\.\d+)?)", re.IGNORECASE)


@dataclass
class Edit:
    path: str
    search: str
    replace: str


class EditError(Exception):
    pass


def parse_edits(text: str) -> list[Edit]:
    edits = []
    for m in _BLOCK_RE.finditer(text):
        raw = m.group("path").strip().strip("`*").strip()
        path = raw.split()[-1] if raw else ""
        edits.append(Edit(path=path, search=m.group("search"), replace=m.group("replace")))
    return edits


def parse_diff_blocks(text: str) -> list[str]:
    return [m.group(1) for m in _DIFF_FENCE_RE.finditer(text)]


def parse_confidence(text: str) -> float | None:
    m = _CONF_RE.search(text)
    if not m:
        return None
    return max(0.0, min(1.0, float(m.group(1))))


def _safe_path(root: Path, rel: str) -> Path:
    if not rel:
        raise EditError("edit block has no file path")
    root_r = root.resolve()
    target = (root / rel).resolve()
    if target != root_r and root_r not in target.parents:
        raise EditError(f"path escapes repository: {rel}")
    return target


def apply_edits(root: Path, edits: list[Edit]) -> None:
    for e in edits:
        target = _safe_path(root, e.path)
        if not e.search.strip():
            # Empty SEARCH means create (or append to) a file.
            target.parent.mkdir(parents=True, exist_ok=True)
            prev = target.read_text() if target.exists() else ""
            text = e.replace if e.replace.endswith("\n") else e.replace + "\n"
            target.write_text(prev + text)
            continue
        if not target.exists():
            raise EditError(f"file not found: {e.path}")
        src = target.read_text()
        if e.search in src:
            target.write_text(src.replace(e.search, e.replace, 1))
            continue
        fixed = _fuzzy_replace(src, e.search, e.replace)
        if fixed is None:
            raise EditError(f"SEARCH block not found in {e.path}")
        target.write_text(fixed)


def _fuzzy_replace(src: str, search: str, replace: str) -> str | None:
    """Match ignoring trailing whitespace and a uniform indentation offset."""
    src_lines = src.splitlines(keepends=True)
    s_lines = [x.rstrip() for x in search.splitlines()]
    n = len(s_lines)
    if n == 0:
        return None
    for strip in (False, True):
        key = [x.strip() if strip else x for x in s_lines]
        for i in range(len(src_lines) - n + 1):
            window = [x.rstrip() for x in src_lines[i:i + n]]
            if [w.strip() if strip else w for w in window] == key:
                rep = replace
                if strip:
                    # Re-indent the replacement to match the source block.
                    src_ind = len(window[0]) - len(window[0].lstrip())
                    s_ind = len(s_lines[0]) - len(s_lines[0].lstrip())
                    delta = src_ind - s_ind
                    if delta > 0:
                        rep = "\n".join((" " * delta + ln) if ln.strip() else ln
                                        for ln in replace.splitlines())
                if rep and not rep.endswith("\n"):
                    rep += "\n"
                return "".join(src_lines[:i]) + rep + "".join(src_lines[i + n:])
    return None
