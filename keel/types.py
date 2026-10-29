"""Core data types shared across Keel."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

AUTO_MERGE = "AUTO-MERGE"
NEEDS_REVIEW = "NEEDS REVIEW"

DEFAULT_TEST_COMMAND = "{python} -m pytest -q -p no:cacheprovider {tests} --junitxml={junit}"
DEFAULT_PROTECTED = ["tests/*", "test/*", "*/tests/*", "test_*.py", "*_test.py", "conftest.py",
                     ".github/*", ".keel.toml"]


@dataclass
class Location:
    """A source location implicated by a failing test (from a traceback)."""

    path: str
    line: int


@dataclass
class BugTask:
    """A repository in a state where some tests fail and should be repaired."""

    task_id: str
    repo_path: str
    failing_tests: list[str] = field(default_factory=list)
    passing_tests: list[str] = field(default_factory=list)
    test_command: str = DEFAULT_TEST_COMMAND
    problem_statement: str = ""
    failure_output: str = ""
    suspicious_locations: list[Location] = field(default_factory=list)
    protected_globs: list[str] = field(default_factory=lambda: list(DEFAULT_PROTECTED))
    test_timeout: int = 300


@dataclass
class Candidate:
    """One candidate patch produced by a generator."""

    candidate_id: str
    generator: str
    sample_index: int
    diff: str
    self_confidence: float | None = None
    raw_response: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    mean_logprob: float | None = None
    min_logprob: float | None = None
    cost_usd: float = 0.0
    latency_s: float = 0.0
    error: str = ""


@dataclass
class TestOutcome:
    """Outcome of running a set of tests on a (possibly patched) workspace."""

    results: dict[str, bool]
    output: str = ""
    timed_out: bool = False

    def passed(self, tests: list[str]) -> int:
        return sum(1 for t in tests if self.results.get(t, False))


@dataclass
class CandidateEvaluation:
    candidate: Candidate
    applied: bool
    apply_error: str = ""
    fail_to_pass: dict[str, bool] = field(default_factory=dict)
    pass_to_pass: dict[str, bool] = field(default_factory=dict)
    attack_results: dict[str, bool] = field(default_factory=dict)
    timed_out: bool = False
    touches_protected: bool = False
    static_before: int = 0
    static_after: int = 0
    syntax_error: bool = False
    behavior_signature: str = ""
    normalized_diff: str = ""
    features: dict[str, float] = field(default_factory=dict)
    score: float = 1.0
    gate_failures: list[str] = field(default_factory=list)
    contributions: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Decision:
    label: str
    alpha: float
    method: str
    threshold: float
    score: float
    candidate_id: str | None
    reasons: list[str]
    guarantee: str
    n_calibration: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RepairReport:
    task: BugTask
    evaluations: list[CandidateEvaluation]
    selected: CandidateEvaluation | None
    decision: Decision
    total_cost_usd: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "task": asdict(self.task),
            "evaluations": [e.to_dict() for e in self.evaluations],
            "selected": self.selected.candidate.candidate_id if self.selected else None,
            "decision": self.decision.to_dict(),
            "total_cost_usd": self.total_cost_usd,
        }
