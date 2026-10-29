"""Report a finished run to the Keel platform (keel.boraqs.com), if the workflow opted in.

Authentication uses the job's GitHub Actions OIDC token (the workflow grants `id-token: write`),
so no secret is shared between the repository and the platform. Reporting never fails a run.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from ..types import RepairReport


def _oidc_token(audience: str) -> str | None:
    url, tok = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not url or not tok:
        return None
    r = httpx.get(url, params={"audience": audience}, headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    r.raise_for_status()
    return r.json().get("value")


def _candidate(e, selected_id: str | None) -> dict:
    """A small, code-free summary of one candidate for the run page (no diffs or model output leave the runner)."""
    c = e.candidate
    top = sorted(e.contributions.items(), key=lambda kv: -abs(kv[1]))[:5]
    return {
        "id": c.candidate_id[:80], "model": c.generator[:40], "selected": c.candidate_id == selected_id,
        "applied": e.applied, "score": round(e.score, 6),
        "tests_passed": sum(e.fail_to_pass.values()), "tests_total": len(e.fail_to_pass),
        "kept_passing": sum(e.pass_to_pass.values()), "kept_total": len(e.pass_to_pass),
        "attacks_passed": sum(e.attack_results.values()), "attacks_total": len(e.attack_results),
        "diff_lines": sum(1 for ln in c.diff.splitlines() if ln[:1] in "+-" and ln[:3] not in ("+++", "---")),
        "gates": [g[:80] for g in e.gate_failures[:5]],
        "top_factors": [[k[:40], round(v, 4)] for k, v in top],
        "cost_usd": round(c.cost_usd, 6),
    }


def payload(report: RepairReport, trigger: str, pr_number: int | None, started_at: datetime) -> dict:
    d, sel = report.decision, report.selected
    sel_id = sel.candidate.candidate_id if sel else None
    return {
        "trigger": trigger[:64],
        "commit_sha": os.environ.get("GITHUB_SHA", "")[:64] or "unknown",
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "n_candidates": len(report.evaluations),
        "selected_score": round(sel.score, 6) if sel else None,
        "threshold": round(d.threshold, 6),
        "decision": d.label,
        "pr_number": pr_number,
        "cost_usd": round(report.total_cost_usd, 6),
        "failing_tests": report.task.failing_tests[:200],
        "reasons": [r[:500] for r in d.reasons[:20]],
        "alpha": d.alpha,
        "method": d.method,
        "guarantee": d.guarantee[:500],
        "n_calibration": d.n_calibration,
        "candidates": [_candidate(e, sel_id) for e in report.evaluations[:50]],
    }


def report_run(report: RepairReport, trigger: str, pr_number: int | None, started_at: datetime, log=print) -> None:
    base = os.environ.get("KEEL_PLATFORM_URL", "").rstrip("/")
    if not base:
        return
    try:
        token = _oidc_token(urlparse(base).hostname or base)
        if not token:
            log("platform: no OIDC token (add `id-token: write` to the workflow); not reporting")
            return
        r = httpx.post(f"{base}/api/runs", json=payload(report, trigger, pr_number, started_at),
                       headers={"Authorization": f"Bearer {token}"}, timeout=20)
        log(f"platform: reported run ({r.status_code})")
    except Exception as e:  # reporting is best effort
        log(f"platform: could not report run: {e}")
