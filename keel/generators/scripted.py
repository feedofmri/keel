"""A deterministic generator that replays canned responses (tests, offline demos)."""

from __future__ import annotations

import json
from pathlib import Path

from .base import Completion, Message


class ScriptedGenerator:
    """Replays responses from a JSON file: {"responses": [...]} or {"<key>": [...]}.

    Each response is either a string or {"text": ..., "mean_logprob": ..., ...}. When a
    key is given (e.g. the task id) that list is used; otherwise "responses".
    """

    def __init__(self, name: str, responses: list | dict, key: str | None = None):
        self.name = name
        self._all = responses
        self.key = key
        self._cursor = 0

    @classmethod
    def from_file(cls, name: str, path: str | Path, key: str | None = None) -> "ScriptedGenerator":
        return cls(name, json.loads(Path(path).read_text()), key=key)

    def _items(self) -> list:
        if isinstance(self._all, list):
            return self._all
        if self.key and self.key in self._all:
            return self._all[self.key]
        return self._all.get("responses", [])

    def complete(self, messages: list[Message], n: int = 1, temperature: float = 0.8,
                 seed: int = 0, max_tokens: int = 4096) -> list[Completion]:
        items = self._items()
        out = []
        for _ in range(n):
            if not items:
                out.append(Completion(text="", error="no scripted responses"))
                continue
            item = items[self._cursor % len(items)]
            self._cursor += 1
            if isinstance(item, str):
                out.append(Completion(text=item, completion_tokens=len(item) // 4))
            else:
                out.append(Completion(text=item.get("text", ""),
                                      completion_tokens=len(item.get("text", "")) // 4,
                                      mean_logprob=item.get("mean_logprob"),
                                      min_logprob=item.get("min_logprob"),
                                      reasoning_tokens=item.get("reasoning_tokens", 0),
                                      cost_usd=item.get("cost_usd", 0.0)))
        return out
