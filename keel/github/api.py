"""Minimal GitHub REST/GraphQL client using the workflow's GITHUB_TOKEN."""

from __future__ import annotations

import os

import httpx

API = os.environ.get("GITHUB_API_URL", "https://api.github.com")


class GitHub:
    def __init__(self, token: str, repo: str):
        self.repo = repo
        self.client = httpx.Client(base_url=API, timeout=30, headers={
            "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"})

    def _req(self, method: str, path: str, **kw) -> dict | list:
        r = self.client.request(method, path, **kw)
        if r.status_code >= 400:
            raise RuntimeError(f"GitHub {method} {path} -> {r.status_code}: {r.text[:300]}")
        return r.json() if r.content else {}

    def ensure_label(self, name: str, color: str, description: str = "") -> None:
        r = self.client.get(f"/repos/{self.repo}/labels/{name}")
        if r.status_code == 404:
            self._req("POST", f"/repos/{self.repo}/labels",
                      json={"name": name, "color": color, "description": description})

    def create_pr(self, head: str, base: str, title: str, body: str) -> dict:
        return self._req("POST", f"/repos/{self.repo}/pulls",
                         json={"head": head, "base": base, "title": title, "body": body,
                               "maintainer_can_modify": True})

    def add_labels(self, number: int, labels: list[str]) -> None:
        self._req("POST", f"/repos/{self.repo}/issues/{number}/labels", json={"labels": labels})

    def comment(self, number: int, body: str) -> None:
        self._req("POST", f"/repos/{self.repo}/issues/{number}/comments", json={"body": body})

    def permission(self, user: str) -> str:
        try:
            d = self._req("GET", f"/repos/{self.repo}/collaborators/{user}/permission")
            return d.get("permission", "none")
        except RuntimeError:
            return "none"

    def pull(self, number: int) -> dict:
        return self._req("GET", f"/repos/{self.repo}/pulls/{number}")

    def enable_auto_merge(self, node_id: str, method: str = "SQUASH") -> None:
        q = ("mutation($id: ID!, $m: PullRequestMergeMethod!) { enablePullRequestAutoMerge("
             "input: {pullRequestId: $id, mergeMethod: $m}) { clientMutationId } }")
        self._req("POST", "/graphql", json={"query": q, "variables": {"id": node_id, "m": method}})
