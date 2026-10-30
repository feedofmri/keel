import { Code, RefTable } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function GitHubAction() {
  useTitle("GitHub Action · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Configure" title="GitHub Action" lead="feedofmri/keel@stable performs the complete repair on your runner and opens a labelled pull request." />

      <h2>Inputs</h2>
      <p>Inputs override <code>.keel.toml</code> for a single workflow.</p>
      <RefTable head={["Input", "Default", "Meaning"]} rows={[
        ["github-token", "github.token", "Token used to push the fix branch and open the pull request."],
        ["models", "muse-spark,muse-spark-open", "Comma-separated generators."],
        ["attacker", "muse-spark", "Model that writes adversarial tests; 'none' to disable."],
        ["alpha", "from .keel.toml", "Risk level α."],
        ["method", "from .keel.toml", "crc or ltt."],
        ["k", "from .keel.toml", "Samples per model."],
        ["calibration", "from .keel.toml", "Path to a calibration JSON."],
        ["python-version", "empty", "Set up this Python first. Leave empty to use the Python your workflow already installed your project with."],
      ]} />

      <h2>Triggers</h2>
      <RefTable head={["Event", "Runs when"]} rows={[
        ["workflow_run", "The workflow named in workflows: finishes with conclusion failure."],
        ["issue_comment", "A comment starts with /keel fix, from someone with write access."],
        ["workflow_dispatch", "Started by hand from the Actions tab, or by Fix now in the Keel app."],
      ]} />

      <h2>Permissions</h2>
      <Code lang="yaml">{`permissions:
  contents: write        # push the keel/ fix branch
  pull-requests: write   # open the pull request
  issues: write          # add the AUTO-MERGE / NEEDS REVIEW label
  id-token: write        # only if you report runs to the Keel app`}</Code>

      <h2>Reporting to the Keel app</h2>
      <p>Workflows created by the app set <code>KEEL_PLATFORM_URL</code> and grant <code>id-token: write</code>. At the end of a run, the Action sends a summary authenticated with the job's GitHub OIDC token, so no shared secret is needed. Reporting never fails a run.</p>
      <p>The summary contains the decision, scores, threshold, cost, failing test names and one line per candidate. Diffs and model output stay on the runner.</p>

      <h2>Install your project first</h2>
      <p>Keel runs your tests, so install your project the same way your CI does before the Keel step, for example <code>pip install -e . pytest</code>.</p>
    </div>
  );
}
