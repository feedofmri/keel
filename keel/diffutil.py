"""Unified-diff parsing and normalisation."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_HUNK_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


@dataclass
class Hunk:
    old_start: int
    old_len: int
    new_start: int
    new_len: int
    added: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)


@dataclass
class FileDiff:
    old_path: str | None
    new_path: str | None
    hunks: list[Hunk] = field(default_factory=list)

    @property
    def path(self) -> str:
        return self.new_path or self.old_path or ""


def _strip_prefix(p: str) -> str | None:
    p = p.strip().split("\t")[0]
    if p == "/dev/null":
        return None
    if p.startswith(("a/", "b/")):
        return p[2:]
    return p


def parse_diff(diff: str) -> list[FileDiff]:
    files: list[FileDiff] = []
    current: FileDiff | None = None
    hunk: Hunk | None = None
    old_path: str | None = None
    for line in diff.splitlines():
        if line.startswith("--- "):
            old_path = _strip_prefix(line[4:])
            hunk = None
            continue
        if line.startswith("+++ "):
            current = FileDiff(old_path=old_path, new_path=_strip_prefix(line[4:]))
            files.append(current)
            hunk = None
            continue
        m = _HUNK_RE.match(line)
        if m and current is not None:
            hunk = Hunk(
                old_start=int(m.group(1)),
                old_len=int(m.group(2) or 1),
                new_start=int(m.group(3)),
                new_len=int(m.group(4) or 1),
            )
            current.hunks.append(hunk)
            continue
        if hunk is None:
            continue
        if line.startswith("+"):
            hunk.added.append(line[1:])
        elif line.startswith("-"):
            hunk.removed.append(line[1:])
    return files


@dataclass
class DiffStats:
    files: int
    hunks: int
    added: int
    removed: int
    paths: list[str]
    ranges: list[tuple[str, int, int]]  # (path, old_start, old_end) in the pre-image


def diff_stats(diff: str) -> DiffStats:
    files = parse_diff(diff)
    added = removed = hunks = 0
    ranges: list[tuple[str, int, int]] = []
    for f in files:
        for h in f.hunks:
            hunks += 1
            added += len(h.added)
            removed += len(h.removed)
            ranges.append((f.path, h.old_start, h.old_start + max(h.old_len, 1) - 1))
    return DiffStats(files=len(files), hunks=hunks, added=added, removed=removed,
                     paths=[f.path for f in files], ranges=ranges)


_COMMENT_RE = re.compile(r"\s+#.*$")


def normalize_line(line: str) -> str:
    """Normalise a code line so cosmetic differences don't break consistency checks."""
    line = _COMMENT_RE.sub("", line)
    line = line.replace('"', "'")
    return re.sub(r"\s+", "", line)


def normalized_diff(diff: str) -> str:
    """Canonical form of a diff: per file, the sorted normalised -/+ lines."""
    parts: list[str] = []
    for f in sorted(parse_diff(diff), key=lambda f: f.path):
        rem = sorted(normalize_line(x) for h in f.hunks for x in h.removed if x.strip())
        add = sorted(normalize_line(x) for h in f.hunks for x in h.added if x.strip())
        parts.append(f.path + "\n-" + "\n-".join(rem) + "\n+" + "\n+".join(add))
    return "\n".join(parts)


def changed_tokens(diff: str) -> set[str]:
    """Token set of changed lines, used for soft similarity across samples."""
    toks: set[str] = set()
    for f in parse_diff(diff):
        for h in f.hunks:
            for sign, lines in (("-", h.removed), ("+", h.added)):
                for line in lines:
                    for tok in re.findall(r"[A-Za-z_][A-Za-z0-9_]*|\d+|\S", line):
                        toks.add(f"{f.path}:{sign}{tok}")
    return toks


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)
