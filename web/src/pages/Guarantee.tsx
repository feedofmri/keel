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
      <PageIntro eyebrow="The guarantee" title="A bound you can write into policy"
        lead="You choose a risk level α. Keel calibrates its auto-merge threshold so that wrong auto-merges stay under it." />

      <Section eyebrow="In one picture" title="Keel stays under the line. Naive rules don't."
        lead="Each curve is the share of bugs that got a wrong fix auto-merged, at every risk level, averaged over many calibration and test splits.">
        <div className="split">
          <div>
            <ul className="bullets">
              <li><b>Bound</b>: the dashed line y = α. A method that respects the guarantee stays at or under it.</li>
              <li><b>Keel</b>: calibrated with conformal risk control. It tracks the bound from below.</li>
              <li><b>Tests pass</b>: merge whenever the visible tests pass. Overfit fixes slip through.</li>
              <li><b>Self-confidence</b>: merge when the model says it's sure. Models are overconfident.</li>
            </ul>
            {data?.simulated && <p className="callout warn" style={{ marginTop: 24 }}>The chart uses simulated evaluation data until the benchmark runs finish. <Link to="/results">See results</Link></p>}
          </div>
          {chart ? <DarkStage draw={chart} viewBox="0 0 640 360" className="g-stage" /> : <div className="stage dark g-stage" />}
        </div>
      </Section>

      <Section tone="tint" eyebrow="Two guarantees" title="Per bug, or per merge">
        <div className="cards c2">
          <div className="card-x">
            <span className="tag">default · method = "crc"</span>
            <h3>Conformal risk control</h3>
            <p className="p-small">On average, at most α of bugs get a wrong fix auto-merged.</p>
            <div className="formula" style={{ marginTop: 20 }}>λ̂ = max {"{"} λ : (Σ wrongᵢ·1[sᵢ ≤ λ] + 1) / (n + 1) ≤ α {"}"}</div>
            <dl><dt>Best for</dt><dd>Removing the most review work while keeping the expected error under α.</dd>
              <dt>Reference</dt><dd><a href="https://arxiv.org/abs/2208.02814">Angelopoulos et al., Conformal Risk Control (2022)</a></dd></dl>
          </div>
          <div className="card-x">
            <span className="tag">method = "ltt"</span>
            <h3>Learn-then-Test</h3>
            <p className="p-small">With probability at least 1 − δ, at most α of auto-merged fixes are wrong.</p>
            <div className="formula" style={{ marginTop: 20 }}>keep λ if P(Bin(kλ, α) ≤ wλ) ≤ δ / |Λ|, then λ̂ = max kept λ</div>
            <dl><dt>Best for</dt><dd>Teams that want a high-confidence bound on the merges themselves. It merges less.</dd>
              <dt>Reference</dt><dd><a href="https://arxiv.org/abs/2110.01052">Angelopoulos et al., Learn then Test (2021)</a></dd></dl>
          </div>
        </div>
      </Section>

      <Section eyebrow="Calibration" title="How the threshold is chosen">
        <div className="split">
          <ol className="steps-v">
            <li><b>Collect held-out bugs</b>Real bugs with hidden tests the agent never sees: QuixBugs and SWE-bench Lite for the shared calibration.</li>
            <li><b>Run Keel on each</b>Record the risk score of the fix Keel would pick, and whether that fix passes the hidden tests.</li>
            <li><b>Find the threshold</b>Take the largest score threshold whose bound is still at or under your α.</li>
            <li><b>Deploy</b>A new fix auto-merges only if its score is at or below that threshold.</li>
          </ol>
          <div>
            <p className="p-large">The calibration is stored with a fingerprint of the models, prompts and scorer that produced it.</p>
            <p className="p-small">If you change models or prompts, the fingerprint no longer matches and Keel refuses to auto-merge until you recalibrate. You can build a calibration from your own history with <code>keel calibrate</code>.</p>
            <Link className="more" to="/docs/calibration">Calibration docs <span className="arrow">→</span></Link>
          </div>
        </div>
      </Section>

      <Section tone="tint" eyebrow="Fine print" title="What the guarantee assumes">
        <div className="cards c2">
          <div className="card-x"><h3>New bugs resemble the calibration bugs</h3><p className="p-small">The bound is distribution-free but assumes exchangeability: your bugs and the calibration bugs come from the same kind of process. A calibration from your own repositories is the closest match.</p></div>
          <div className="card-x"><h3>More calibration, more merging</h3><p className="p-small">With n calibration bugs the smallest certifiable risk is 1/(n + 1). Below that, Keel can't certify any threshold, and every fix goes to review. That's the safe default.</p></div>
          <div className="card-x"><h3>It's a rate, not a promise per PR</h3><p className="p-small">CRC bounds the average share of wrong auto-merges; any single PR can still be wrong. That's why Keel watches reverts and lets you mark wrong merges in the app.</p></div>
          <div className="card-x"><h3>"Wrong" means fails hidden tests</h3><p className="p-small">Correctness is judged by tests the agent never saw. It doesn't measure style or how serious a mistake is.</p></div>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/results", title: "Results", text: "Move the risk level and see the bound hold on held-out bugs." },
        { to: "/how-it-works", title: "How it works", text: "Where the risk score comes from." },
        { to: "/docs/calibration", title: "Calibration docs", text: "Build and refresh a calibration for your repositories." },
      ]} />
    </>
  );
}
