import { Link } from "react-router-dom";
import { Code } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function Quickstart() {
  useTitle("Quickstart · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Getting started" title="Quickstart" lead="Connect a repository and get your first labelled fix. There are two ways in: the Keel app, or the GitHub Action on its own." />

      <h2>With the Keel app (recommended)</h2>
      <ol>
        <li><strong>Sign in</strong> at <Link to="/login">keel.boraqs.com</Link> with GitHub and install the Keel GitHub App on the repositories you choose.</li>
        <li><strong>Set up a repository.</strong> Keel detects your language, install command and CI workflow. Adjust anything that's off.</li>
        <li><strong>Choose models and add keys.</strong> Pick Muse Spark and Muse Spark Open, paste your API keys. They're stored as encrypted repository secrets.</li>
        <li><strong>Set your risk level α</strong> and the guarantee (per bug or per merge), and whether AUTO-MERGE should only label or actually merge.</li>
        <li><strong>Merge the setup pull request.</strong> It adds <code>.github/workflows/keel.yml</code> and <code>.keel.toml</code>. Keel is live.</li>
      </ol>
      <p>The next time your CI fails, Keel opens a pull request labelled AUTO-MERGE or NEEDS REVIEW, and the run appears in the app.</p>

      <h2>With the GitHub Action only</h2>
      <p>Copy the example workflow into your repository and add your model keys as repository secrets.</p>
      <Code lang="yaml">{`# .github/workflows/keel.yml
name: Keel
on:
  workflow_run: { workflows: [CI], types: [completed] }
  issue_comment: { types: [created] }
  workflow_dispatch:
permissions: { contents: write, pull-requests: write, issues: write }
jobs:
  keel:
    if: >-
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure') ||
      (github.event_name == 'issue_comment' && startsWith(github.event.comment.body, '/keel fix')) ||
      github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { ref: \${{ github.event.workflow_run.head_sha || github.ref }} }
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -e . pytest
      - uses: feedofmri/keel@v1
        env:
          KEEL_MUSE_SPARK_BASE_URL: \${{ secrets.KEEL_MUSE_SPARK_BASE_URL }}
          KEEL_MUSE_SPARK_API_KEY: \${{ secrets.KEEL_MUSE_SPARK_API_KEY }}
          KEEL_MUSE_SPARK_MODEL: \${{ secrets.KEEL_MUSE_SPARK_MODEL }}
          KEEL_SPARK_OPEN_API_KEY: \${{ secrets.KEEL_SPARK_OPEN_API_KEY }}
        with:
          calibration: .keel/calibration.json`}</Code>
      <p className="callout">Without a calibration file Keel still repairs and explains, but labels every fix NEEDS REVIEW. See <Link to="/docs/calibration">Calibration</Link>.</p>

      <h2>Try it locally</h2>
      <Code lang="shell">{`pip install git+https://github.com/feedofmri/keel
keel doctor                       # which model endpoints are configured
keel repair --repo path/to/repo   # find failing tests, repair, print the PR body`}</Code>
      <p>No keys yet? The offline demo replays recorded model responses:</p>
      <Code lang="shell">{`keel repair --repo examples/demo_repo --cache "" \\
  --models scripted:muse-spark:examples/responses/muse-spark.json,scripted:muse-spark-open:examples/responses/muse-spark-open.json \\
  --attacker scripted:attacker:examples/responses/attacker.json`}</Code>
    </div>
  );
}
