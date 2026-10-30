from keel.github.action import fix_branch, parse_event


class FakeGH:
    def __init__(self, perm="write"):
        self.perm = perm

    def permission(self, user):
        return self.perm

    def pull(self, n):
        return {"head": {"ref": "feature-x"}}


def test_workflow_run_failure_triggers():
    t = parse_event("workflow_run", {"workflow_run": {"conclusion": "failure", "head_branch": "main", "name": "CI",
                                                      "pull_requests": []}}, None, "main")
    assert t.should_run and t.base_branch == "main"


def test_workflow_run_success_ignored():
    assert not parse_event("workflow_run", {"workflow_run": {"conclusion": "success"}}, None, "main").should_run


def test_keel_branches_do_not_recurse():
    ev = {"workflow_run": {"conclusion": "failure", "head_branch": "keel/fix-1"}}
    assert not parse_event("workflow_run", ev, None, "main").should_run


def test_comment_requires_write_access():
    ev = {"comment": {"body": "/keel fix please", "user": {"login": "stranger"}}, "issue": {"number": 3}}
    assert not parse_event("issue_comment", ev, FakeGH("read"), "main").should_run
    t = parse_event("issue_comment", ev, FakeGH("write"), "main")
    assert t.should_run and t.issue_number == 3


def test_comment_on_pr_targets_pr_branch():
    ev = {"comment": {"body": "/keel fix", "user": {"login": "me"}}, "issue": {"number": 7, "pull_request": {}}}
    assert parse_event("issue_comment", ev, FakeGH(), "main").base_branch == "feature-x"


def test_other_comments_ignored():
    ev = {"comment": {"body": "looks good", "user": {"login": "me"}}, "issue": {"number": 1}}
    assert not parse_event("issue_comment", ev, FakeGH(), "main").should_run


def test_fix_branch_is_unique_per_attempt():
    assert fix_branch({"GITHUB_RUN_ID": "42"}) == "keel/fix-42"
    assert fix_branch({"GITHUB_RUN_ID": "42", "GITHUB_RUN_ATTEMPT": "1"}) == "keel/fix-42"
    # a re-run keeps the run ID; its branch must not collide with the first attempt's
    assert fix_branch({"GITHUB_RUN_ID": "42", "GITHUB_RUN_ATTEMPT": "2"}) == "keel/fix-42-2"
    assert fix_branch({}) == "keel/fix-local"
