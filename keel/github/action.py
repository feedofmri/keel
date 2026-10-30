"""`keel action`: entry point used by the Keel GitHub Action.

Triggers (from the calling workflow):
  * workflow_run  - the CI workflow finished with conclusion "failure"
  * issue_comment - "/keel fix" on an issue or pull request, by a user with write access
  * issues        - an issue labelled "keel"
  * workflow_dispatch - manual run (handy for live demos)

Keel repairs the checked-out workspace, then opens a pull request labelled AUTO-MERGE or
NEEDS REVIEW with the explanation, and writes the same report to the job summary.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from ..cli import build_pipeline
from ..config import KeelConfig
from ..report import pr_body
from ..sandbox import git
from ..types import AUTO_MERGE, BugTask
from .api import GitHub
from .platform import report_run

COMMAND_RE = re.compile(r"^\s*/keel\s+fix\b", re.IGNORECASE | re.MULTILINE)
WRITE_PERMS = {"admin", "maintain", "write"}


@dataclass
class Trigger:
    should_run: bool
    reason: str
    base_branch: str = ""
    issue_number: int | None = None   # where to comment
    problem: str = ""


def _log(m: str) -> None:
    print(f"[keel] {m}", file=sys.stderr, flush=True)


def parse_event(event_name: str, event: dict, gh: GitHub | None, default_branch: str) -> Trigger:
    if event_name == "workflow_run":
        run = event.get("workflow_run", {})
        if run.get("conclusion") != "failure":
            return Trigger(False, f"workflow concluded {run.get('conclusion')!r}, nothing to fix")
        if (run.get("head_branch") or "").startswith("keel/"):
            return Trigger(False, "failure is on a Keel branch; not recursing")
        prs = run.get("pull_requests") or []
        return Trigger(True, f"CI workflow '{run.get('name')}' failed",
                       base_branch=run.get("head_branch") or default_branch,
                       issue_number=prs[0]["number"] if prs else None)
    if event_name == "issue_comment":
        c = event.get("comment", {})
        if not COMMAND_RE.search(c.get("body") or ""):
            return Trigger(False, "comment is not a /keel fix command")
        user = (c.get("user") or {}).get("login", "")
        if gh is not None and gh.permission(user) not in WRITE_PERMS:
            return Trigger(False, f"@{user} does not have write access; ignoring")
        issue = event.get("issue", {})
        base = default_branch
        if "pull_request" in issue and gh is not None:
            base = gh.pull(issue["number"])["head"]["ref"]
        return Trigger(True, f"/keel fix requested by @{user}", base_branch=base, issue_number=issue.get("number"),
                       problem=f"{issue.get('title', '')}\n\n{issue.get('body') or ''}".strip())
    if event_name == "issues":
        issue = event.get("issue", {})
        if (event.get("label") or {}).get("name") != "keel":
            return Trigger(False, "label is not 'keel'")
        return Trigger(True, "issue labelled keel", base_branch=default_branch, issue_number=issue.get("number"),
                       problem=f"{issue.get('title', '')}\n\n{issue.get('body') or ''}".strip())
    if event_name == "workflow_dispatch":
        return Trigger(True, "manual run", base_branch=os.environ.get("GITHUB_REF_NAME", default_branch),
                       problem=(event.get("inputs") or {}).get("issue", ""))
    return Trigger(False, f"unsupported event {event_name!r}")


def _summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a") as f:
            f.write(text + "\n")


def cmd_action(a: argparse.Namespace) -> int:
    ws = Path(os.environ.get("GITHUB_WORKSPACE", ".")).resolve()
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    event_name = os.environ.get("GITHUB_EVENT_NAME", "workflow_dispatch")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text()) if os.environ.get("GITHUB_EVENT_PATH") else {}
    default_branch = (event.get("repository") or {}).get("default_branch", "main")
    gh = GitHub(token, repo) if token and repo and not a.dry_run else None

    trig = parse_event(event_name, event, gh, default_branch)
    _log(trig.reason)
    if not trig.should_run:
        return 0

    cfg = KeelConfig.load(ws)
    env = os.environ.get
    if env("KEEL_INPUT_ALPHA"):
        cfg.alpha = float(env("KEEL_INPUT_ALPHA"))
    if env("KEEL_INPUT_METHOD"):
        cfg.method = env("KEEL_INPUT_METHOD")
    if env("KEEL_INPUT_K"):
        cfg.k = int(env("KEEL_INPUT_K"))
    models = env("KEEL_INPUT_MODELS", "").split(",") if env("KEEL_INPUT_MODELS") else cfg.models
    attacker = env("KEEL_INPUT_ATTACKER") or cfg.attacker
    if attacker == "none":
        attacker = None
    calibration = env("KEEL_INPUT_CALIBRATION") or cfg.calibration
    if calibration and not Path(calibration).is_absolute():
        calibration = str(ws / calibration)

    tmp = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "keel"
    tmp.mkdir(parents=True, exist_ok=True)
    pipe = build_pipeline(cfg, models, attacker, cfg.triage, cfg.explainer, calibration,
                          cache=str(tmp / "cache"), log=_log)
    task = BugTask(task_id=f"{repo}@{trig.base_branch}", repo_path=str(ws), test_command=cfg.test_command,
                   protected_globs=cfg.protected_globs, test_timeout=cfg.test_timeout, problem_statement=trig.problem)
    started = datetime.now(timezone.utc)
    report = pipe.run(task)
    body = pr_body(report, pipe.summary(report.decision))
    _summary(body)
    (tmp / "report.json").write_text(json.dumps(report.to_dict(), indent=1, default=str))

    sel = report.selected
    if sel is None or not sel.applied or sel.gate_failures:
        _log("no candidate passes the gates; reporting without a PR")
        if gh and trig.issue_number:
            gh.comment(trig.issue_number, "### Keel could not produce a safe fix\n\n" + body)
        report_run(report, event_name, None, started, log=_log)
        return 0

    label = report.decision.label
    branch = fix_branch(os.environ)
    git(ws, "checkout", "-q", "-b", branch)
    r = git(ws, "apply", "-", check=False, input=sel.candidate.diff)
    if r.returncode != 0:
        _log(f"could not apply the selected patch: {r.stderr}")
        return 1
    git(ws, "add", "-A")
    git(ws, "-c", "user.name=keel[bot]", "-c", "user.email=keel-bot@users.noreply.github.com",
        "commit", "-q", "-m", f"Keel: fix {', '.join(report.task.failing_tests[:3])}"[:200])
    if a.dry_run or gh is None:
        _log(f"dry run: would push {branch} and open a {label} PR into {trig.base_branch}")
        print(body)
        return 0
    r = git(ws, "push", "-q", "origin", branch, check=False)
    if r.returncode != 0:
        _log(f"could not push {branch}: {r.stderr.strip()}")
        return 1
    for name, color in cfg.labels.items():
        gh.ensure_label(name, color, "Set by Keel (conformal risk control)")
    title = f"[{label}] Keel fix for {len(report.task.failing_tests)} failing test(s)"
    pr = gh.create_pr(branch, trig.base_branch, title, body)
    gh.add_labels(pr["number"], [label])
    _log(f"opened PR #{pr['number']} labelled {label}")
    if label == AUTO_MERGE and cfg.enable_auto_merge:
        try:
            gh.enable_auto_merge(pr["node_id"])
            _log("auto-merge enabled")
        except RuntimeError as e:
            _log(f"could not enable auto-merge: {e}")
    if trig.issue_number:
        gh.comment(trig.issue_number, f"Keel opened {pr['html_url']} ({label}).")
    report_run(report, event_name, pr["number"], started, log=_log)
    return 0


def fix_branch(env) -> str:
    """The branch for this run's fix. A re-run keeps its run ID, so later attempts get their own branch."""
    name = f"keel/fix-{env.get('GITHUB_RUN_ID', 'local')}"
    attempt = env.get("GITHUB_RUN_ATTEMPT", "1")
    return name if attempt in ("", "1") else f"{name}-{attempt}"


def add_action_command(sub) -> None:
    p = sub.add_parser("action", help="entry point for the Keel GitHub Action")
    p.add_argument("--dry-run", action="store_true", help="do everything except push / open the PR")
    p.set_defaults(fn=cmd_action)
