// Open (or refresh) the single setup pull request Keel makes in a repository.

type Octo = { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: any }> };

const BRANCH = "keel/setup";

export async function openSetupPR(octo: Octo, owner: string, repo: string, baseBranch: string,
                                  files: Record<string, string>, body: string): Promise<{ number: number; url: string }> {
  const { data: base } = await octo.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo, ref: `heads/${baseBranch}` });
  try {
    await octo.request("POST /repos/{owner}/{repo}/git/refs", { owner, repo, ref: `refs/heads/${BRANCH}`, sha: base.object.sha });
  } catch {
    await octo.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo, ref: `heads/${BRANCH}`, sha: base.object.sha, force: true });
  }
  for (const [path, content] of Object.entries(files)) {
    let sha: string | undefined;
    try {
      const { data } = await octo.request("GET /repos/{owner}/{repo}/contents/{path}", { owner, repo, path, ref: BRANCH });
      sha = data.sha;
    } catch { sha = undefined; }
    await octo.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner, repo, path, branch: BRANCH, sha, message: `Keel: add ${path}`,
      content: Buffer.from(content, "utf8").toString("base64") });
  }
  const { data: open } = await octo.request("GET /repos/{owner}/{repo}/pulls", { owner, repo, head: `${owner}:${BRANCH}`, state: "open" });
  if (open.length) return { number: open[0].number, url: open[0].html_url };
  const { data: pr } = await octo.request("POST /repos/{owner}/{repo}/pulls", {
    owner, repo, head: BRANCH, base: baseBranch, title: "Set up Keel: trustworthy auto-repair for failing tests", body });
  return { number: pr.number, url: pr.html_url };
}

export function setupPRBody(appUrl: string, alpha: number, method: string, autoMerge: boolean, calibration: { n: number; source: string } | null = null): string {
  return `This pull request adds **Keel** to the repository.

When CI fails (or someone with write access comments \`/keel fix\`), Keel:
1. generates candidate fixes with Meta's Muse Spark and Muse Spark Open,
2. attacks them with new tests written by Muse Spark,
3. scores every patch and opens a pull request labelled **AUTO-MERGE** or **NEEDS REVIEW**.

**Policy:** risk level α = ${Math.round(alpha * 100)}% (${method.toUpperCase()}), ${autoMerge ? "AUTO-MERGE PRs are merged automatically" : "labels only, nothing is merged automatically"}.

Files added:
- \`.github/workflows/keel.yml\`: runs Keel on your own GitHub runners
- \`.keel.toml\`: the policy above, editable any time
${calibration ? `- \`.keel/calibration.json\`: the shared calibration (${calibration.n} held-out bugs, ${calibration.source}) that sets the merge threshold\n` : ""}
${calibration ? "" : "**Calibration:** no shared calibration has been published yet, so Keel will label fixes but will not merge any automatically. A later settings pull request adds the calibration once it is available.\n"}
Merge this PR to activate Keel. Manage it at ${appUrl}/app.

---
_Opened by [Keel](${appUrl})._`;
}
