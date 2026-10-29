import { Link } from "react-router-dom";
import { Code } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function Evaluation() {
  useTitle("Evaluation · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Reference" title="Evaluation" lead="How the numbers on the Results page are produced, and how to reproduce them." />
      <h2>Protocol</h2>
      <ul>
        <li><strong>Hidden tests.</strong> Keel only sees half of the failing tests. A fix is correct if it passes all hidden tests; for SWE-bench, every FAIL_TO_PASS and PASS_TO_PASS test in the official Docker harness.</li>
        <li><strong>Checked labels.</strong> For QuixBugs, the reference fix passes and the buggy program fails the hidden tests, for all 40 programs.</li>
        <li><strong>Splits.</strong> Bugs are split into fit, calibration and test sets, repeated over 200 random splits.</li>
        <li><strong>Baselines.</strong> Merge whenever tests pass; merge when the model's self-confidence is at least 1 − α; Keel's score without calibration; and an oracle.</li>
      </ul>
      <h2>Run it</h2>
      <Code lang="shell">{`keel eval quixbugs  --models muse-spark,muse-spark-open --k 5
keel eval swebench  --n 100 --stage all
keel eval analyze   results/quixbugs/records.jsonl --out web/public/data/results.json`}</Code>
      <p>Both benchmarks also run from the repository's Actions tab: <em>Benchmark – QuixBugs</em> and <em>Benchmark – SWE-bench Lite</em>. They commit the results, and the <Link to="/results">Results</Link> page updates.</p>
      <p className="callout warn">Until those runs finish, the Results page shows simulated data and says so.</p>
    </div>
  );
}
