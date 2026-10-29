import { Code, RefTable } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function Configuration() {
  useTitle("Configuration · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Configure" title="Configuration" lead="Keel reads .keel.toml from the root of your repository. Every key is optional; the setup pull request writes the ones you chose." />
      <Code lang=".keel.toml">{`[keel]
alpha = 0.10            # accept at most 10% wrong auto-merges
method = "crc"          # "crc" (per bug) or "ltt" (per merge)
k = 5                   # samples per model
models = ["muse-spark", "muse-spark-open"]
attacker = "muse-spark" # writes adversarial tests
calibration = ".keel/calibration.json"
enable_auto_merge = false   # label only; true lets GitHub merge AUTO-MERGE PRs`}</Code>

      <h2>Decision</h2>
      <RefTable head={["Key", "Default", "Meaning"]} rows={[
        ["alpha", "0.1", "Risk level α, between 0 and 1."],
        ["method", "\"crc\"", "\"crc\": at most α of bugs get a wrong merge, on average. \"ltt\": at most α of merges are wrong, with probability 1 − δ."],
        ["delta", "0.1", "δ for Learn-then-Test."],
        ["calibration", "none", "Path to a calibration JSON in the repository. Without one, Keel never auto-merges."],
        ["enable_auto_merge", "false", "When true, AUTO-MERGE pull requests use GitHub auto-merge (required checks still apply)."],
      ]} />

      <h2>Models</h2>
      <RefTable head={["Key", "Default", "Meaning"]} rows={[
        ["models", "[\"muse-spark\", \"muse-spark-open\"]", "Generators. Any of muse-spark, muse-spark-open, muse-glimmer."],
        ["k", "5", "Samples per model."],
        ["temperature", "0.8", "Sampling temperature for generators."],
        ["attacker", "\"muse-spark\"", "Model that writes adversarial tests. Set to \"none\" to turn attacks off."],
        ["triage", "none", "Optional cheap model (e.g. \"muse-glimmer\") that sets the sample budget per bug."],
        ["explainer", "none", "Optional model (e.g. \"muse-spark\") that writes a plain-English summary in the PR."],
      ]} />

      <h2>Tests</h2>
      <RefTable head={["Key", "Default", "Meaning"]} rows={[
        ["test_command", "{python} -m pytest -q -p no:cacheprovider {tests} --junitxml={junit}", "How Keel runs tests. {tests} and {junit} are filled in per run."],
        ["test_timeout", "300", "Seconds before a test run is stopped and the candidate is gated out."],
        ["protected_globs", "tests/*, test/*, */tests/*, test_*.py, *_test.py, conftest.py, .github/*, .keel.toml", "Files a candidate may not touch."],
        ["labels", "AUTO-MERGE: 0e8a16, NEEDS REVIEW: fbca04", "Label names and colours on Keel's pull requests."],
      ]} />

      <h2>Model endpoints</h2>
      <p>Each model reads three secrets: a base URL, an API key and a model id. Muse Spark Open defaults to Baseten and <code>meta-models/muse-spark-open-1026</code>.</p>
      <RefTable head={["Model", "Secrets"]} rows={[
        ["muse-spark", "KEEL_MUSE_SPARK_BASE_URL, KEEL_MUSE_SPARK_API_KEY, KEEL_MUSE_SPARK_MODEL"],
        ["muse-spark-open", "KEEL_SPARK_OPEN_BASE_URL (optional), KEEL_SPARK_OPEN_API_KEY, KEEL_SPARK_OPEN_MODEL (optional)"],
        ["muse-glimmer", "KEEL_GLIMMER_BASE_URL, KEEL_GLIMMER_API_KEY, KEEL_GLIMMER_MODEL"],
      ]} />
    </div>
  );
}
