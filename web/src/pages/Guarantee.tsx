import { useMemo } from "react";
import { Link } from "react-router-dom";
import { DarkStage } from "../components/DarkStage";
import { NextLinks, PageIntro, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { useResults } from "../lib/results";
import { drawGuarantee } from "../visuals/stages";

export default function Guarantee() {
  useTitle("The Keel Guarantee");
  const { data } = useResults();
  const chart = useMemo(() => (data ? drawGuarantee(data) : null), [data]);
  return (
    <>
      <PageIntro title="The Keel guarantee"
        lead="You select a risk level α. Keel calibrates its merge threshold so that the rate of incorrect automatic merges remains at or below α." />

      <Section title="Observed error against the bound"
        lead="Each curve shows the share of bugs that received an incorrect automatic merge at each risk level, averaged over repeated calibration and test splits.">
        <div className="split">
          <div>
            <ul className="bullets">
              <li><b>Bound</b>: the dashed line y = α. A method that satisfies the guarantee remains at or below it.</li>
              <li><b>Keel</b>: calibrated with conformal risk control. It remains below the bound.</li>
              <li><b>Tests pass</b>: merge whenever the visible tests pass. Overfitted patches are merged.</li>
              <li><b>Self-confidence</b>: merge when the model reports high confidence. Model confidence is poorly calibrated.</li>
            </ul>
            {data?.simulated && <p className="callout warn" style={{ marginTop: 24 }}>The chart uses simulated evaluation data until benchmark results are published. <Link to="/results">View results</Link></p>}
          </div>
          {chart ? <DarkStage draw={chart} viewBox="0 0 640 360" className="g-stage" /> : <div className="stage dark g-stage" />}
        </div>
      </Section>

      <Section tone="tint" title="Two forms of guarantee">
        <div className="cards c2">
          <div className="card-x">
            <span className="tag">default · method = "crc"</span>
            <h3>Conformal risk control</h3>
            <p className="p-small">On average, no more than α of bugs receive an incorrect automatic merge.</p>
            <div className="formula" style={{ marginTop: 20 }}>λ̂ = max {"{"} λ : (Σ wrongᵢ·1[sᵢ ≤ λ] + 1) / (n + 1) ≤ α {"}"}</div>
            <dl><dt>Recommended for</dt><dd>Reducing review effort as far as possible while keeping the expected error below α.</dd>
              <dt>Reference</dt><dd><a href="https://arxiv.org/abs/2208.02814">Angelopoulos et al., Conformal Risk Control (2022)</a></dd></dl>
          </div>
          <div className="card-x">
            <span className="tag">method = "ltt"</span>
            <h3>Learn-then-Test</h3>
            <p className="p-small">With probability at least 1 − δ, no more than α of automatically merged patches are incorrect.</p>
            <div className="formula" style={{ marginTop: 20 }}>keep λ if P(Bin(kλ, α) ≤ wλ) ≤ δ / |Λ|, then λ̂ = max kept λ</div>
            <dl><dt>Recommended for</dt><dd>Teams that require a high-confidence bound on merged changes. Fewer patches are merged automatically.</dd>
              <dt>Reference</dt><dd><a href="https://arxiv.org/abs/2110.01052">Angelopoulos et al., Learn then Test (2021)</a></dd></dl>
          </div>
        </div>
      </Section>

      <Section title="Calibration">
        <div className="split">
          <ol className="steps-v">
            <li><b>Collect held-out bugs</b>Real bugs with hidden tests that are not shown to Keel. The shared calibration uses QuixBugs and SWE-bench Lite.</li>
            <li><b>Run Keel on each bug</b>Record the risk score of the selected patch and whether it passes the hidden tests.</li>
            <li><b>Compute the threshold</b>Select the largest score threshold whose bound remains at or below α.</li>
            <li><b>Apply it</b>A new patch is approved for merge only if its score is at or below that threshold.</li>
          </ol>
          <div>
            <p className="p-large">The calibration is stored with a fingerprint of the models, prompts and scorer that produced it.</p>
            <p className="p-small">If the models or prompts change, the fingerprint no longer matches and Keel does not merge automatically until the calibration is rebuilt. A calibration can be built from your own history with <code>keel calibrate</code>.</p>
            <Link className="more" to="/docs/calibration">Calibration docs <span className="arrow">→</span></Link>
          </div>
        </div>
      </Section>

      <Section tone="tint" title="Assumptions">
        <div className="cards c2">
          <div className="card-x"><h3>Comparable bugs</h3><p className="p-small">The bound is distribution-free but assumes exchangeability: new bugs and calibration bugs arise from the same kind of process. A calibration built from your own repositories provides the closest match.</p></div>
          <div className="card-x"><h3>Calibration size</h3><p className="p-small">With n calibration bugs, the smallest risk level that can be certified is 1/(n + 1). Below that level, no threshold can be certified and every patch is sent for review.</p></div>
          <div className="card-x"><h3>A rate, not a per-change promise</h3><p className="p-small">Conformal risk control bounds the average share of incorrect automatic merges; an individual pull request may still be incorrect. Keel therefore records reverts and allows maintainers to mark incorrect merges.</p></div>
          <div className="card-x"><h3>Definition of correctness</h3><p className="p-small">A patch is considered correct if it passes hidden tests that were not shown to Keel. The measure does not assess code style or the severity of an error.</p></div>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/results", title: "Results", text: "Adjust the risk level and review the results on held-out bugs." },
        { to: "/how-it-works", title: "How it works", text: "How the risk score is computed." },
        { to: "/docs/calibration", title: "Calibration docs", text: "Build and maintain a calibration for your repositories." },
      ]} />
    </>
  );
}
