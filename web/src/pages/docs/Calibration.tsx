import { Link } from "react-router-dom";
import { Code } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function CalibrationDocs() {
  useTitle("Calibration · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Configure" title="Calibration" lead="A calibration converts the configured risk level α into a merge threshold. Keel does not merge automatically without one." />

      <h2>Contents of a calibration</h2>
      <p>A calibration JSON holds, for each held-out bug, the risk score of the fix Keel selected and whether that fix passed hidden tests. It also stores the fitted score weights and a fingerprint of the models and pipeline settings that produced it.</p>

      <h2>The shared calibration</h2>
      <p>Repositories configured through the Keel application use the shared calibration built from QuixBugs and SWE-bench Lite. In this case, the guarantee assumes that your bugs are comparable to those benchmark bugs.</p>

      <h2>Build your own</h2>
      <p>Records come from <code>keel eval</code> runs (one JSON line per bug, with the hidden-test outcome). Fit the score and build the calibration:</p>
      <Code lang="shell">{`keel eval quixbugs --models muse-spark,muse-spark-open --k 5
keel calibrate results/quixbugs/records.jsonl --out .keel/calibration.json
# options: --fit-fraction 0.5  --seed 0  --models …  --k 5  --no-attack  --triage muse-glimmer`}</Code>
      <p>Commit the file and point <code>calibration</code> in <code>.keel.toml</code> at it.</p>

      <h2>Fingerprints and staleness</h2>
      <p>If you change models, samples per model, the attacker or triage, the pipeline's fingerprint changes. Keel then refuses the old calibration and labels every fix NEEDS REVIEW, with a note saying to recalibrate. <code>keel repair --allow-stale</code> overrides this for local experiments only.</p>

      <h2>How much data</h2>
      <p>With n calibration bugs, the smallest risk level Keel can certify is 1/(n + 1). For α = 10% you need at least 10 bugs; in practice a few hundred give a threshold that merges a useful share of fixes.</p>

      <h2>Watching it in production</h2>
      <p>The app's <Link to="/app/calibration">Calibration</Link> page compares the observed share of wrong auto-merges in each repository with its α, counting reverts and fixes marked wrong.</p>
    </div>
  );
}
