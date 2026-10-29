"""Generator interface: anything that turns a chat prompt into completions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class Completion:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    mean_logprob: float | None = None
    min_logprob: float | None = None
    cost_usd: float = 0.0
    latency_s: float = 0.0
    cached: bool = False
    error: str = ""
    meta: dict = field(default_factory=dict)


Message = dict[str, str]


class Generator(Protocol):
    name: str

    def complete(self, messages: list[Message], n: int = 1, temperature: float = 0.8,
                 seed: int = 0, max_tokens: int = 4096) -> list[Completion]:
        ...
