import { Code, RefTable } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function Cli() {
  useTitle("CLI · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Reference" title="CLI" lead="The keel command provides the functionality of the GitHub Action, together with evaluation and calibration tools." />
      <Code lang="shell">{`pip install git+https://github.com/feedofmri/keel
keel --help`}</Code>

      <h2>keel repair</h2>
      <p>Repair failing tests in a repository and print the pull request body.</p>
      <RefTable head={["Option", "Meaning"]} rows={[
        ["--repo PATH", "Repository to repair (default: current directory)."],
        ["--failing ID …", "Failing test node ids. Default: discover by running the tests."],
        ["--issue FILE", "A file with the issue or problem statement."],
        ["--models LIST", "muse-spark, muse-spark-open, muse-glimmer, or scripted:NAME:FILE."],
        ["--attacker NAME / --no-attack", "Model for adversarial tests, or turn attacks off."],
        ["--triage NAME / --explainer NAME", "Optional triage and explanation models."],
        ["--calibration FILE", "Calibration JSON. --allow-stale accepts a different fingerprint."],
        ["--alpha / --method / --k", "Override the decision settings."],
        ["--json FILE / --body FILE", "Write the full report as JSON, or the PR body as Markdown."],
        ["--apply", "Apply the selected patch to the repository."],
        ["--cache DIR", "Model response cache (default .keel-cache; empty to disable)."],
      ]} />

      <h2>keel doctor</h2>
      <p>Shows which Meta model endpoints are configured from the environment.</p>

      <h2>keel calibrate</h2>
      <p>Builds a deployment calibration from evaluation records: <code>keel calibrate RECORDS… --out FILE</code>.</p>

      <h2>keel eval</h2>
      <RefTable head={["Command", "Meaning"]} rows={[
        ["keel eval quixbugs", "Run Keel on the 40 QuixBugs programs with hidden-test labels."],
        ["keel eval swebench --stage …", "SWE-bench Lite: generate, harness (official Docker harness), records, or all."],
        ["keel eval analyze RECORDS…", "Repeated random splits; writes the results page JSON."],
        ["keel eval simulate", "Simulated records, for tests and the offline demo only. Always flagged as simulated."],
      ]} />

      <h2>keel action</h2>
      <p>The entry point used by the GitHub Action. It is not intended to be run directly.</p>
    </div>
  );
}
