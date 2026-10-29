import { Link } from "react-router-dom";
import { DarkStage } from "../components/DarkStage";
import { NextLinks, PageIntro, Points, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { drawAttack, drawDecide, drawGenerate, drawScore } from "../visuals/stages";

const STAGES = [
  { title: "Generate", draw: drawGenerate, cap: "keel repair · 10 candidates",
    text: "Keel reads the failing tests and the traceback, then asks two Meta models for fixes.",
    points: ["Five samples from Muse Spark and five from Muse Spark Open by default (k = 5 each).",
      "The prompt includes the failing test, its output, and the code the traceback points at.",
      "Every candidate is applied in its own private git workspace and run against your tests."] },
  { title: "Attack", draw: drawAttack, cap: "candidates × adversarial tests",
    text: "Passing the failing test isn't enough. Muse Spark writes new tests aimed at where the candidates disagree.",
    points: ["The attacker sees every candidate and targets the behaviour they differ on.",
      "Each candidate runs against every adversarial test; the matrix is part of the score.",
      "A fix that only satisfies the visible test usually breaks here."] },
  { title: "Score", draw: drawScore, cap: "risk score · lower is safer",
    text: "Hard gates first, then one calibrated risk score between 0 and 1 for every surviving candidate.",
    points: ["Gates: the patch applies, failing tests pass, passing tests keep passing, no syntax errors, no timeouts, no edits to tests or CI.",
      "Signals: adversarial survival, agreement across samples and across models, diff size, locality to the traceback, static-analysis change, token log-probabilities.",
      "The candidate with the lowest score is selected."] },
  { title: "Decide", draw: drawDecide, cap: "labelled pull requests",
    text: "The selected fix is compared with a threshold calibrated for your risk level α.",
    points: ["At or below the threshold: the PR is labelled AUTO-MERGE.",
      "Above it: NEEDS REVIEW, with the reasons a reviewer should look at.",
      "Label-only by default; turn on auto-merge and GitHub merges once required checks pass."] },
];

export default function HowItWorks() {
  useTitle("How Keel Works");
  return (
    <>
      <PageIntro eyebrow="How it works" title="From a red build to a decision you can defend"
        lead="Keel writes candidate fixes, attacks them, scores them, and only lets through the ones its calibration can vouch for." />

      <Section eyebrow="The pipeline" title="Four steps, every run">
        <div className="stack">
          {STAGES.map((s, i) => (
            <div className="split mid" key={s.title}>
              <div>
                <div className="idx mono muted" style={{ fontSize: 12 }}>0{i + 1}</div>
                <h3 className="h-panel">{s.title}</h3>
                <p className="p-small">{s.text}</p>
                <ul className="bullets">{s.points.map(p => <li key={p}>{p}</li>)}</ul>
              </div>
              <DarkStage draw={s.draw} caption={s.cap} />
            </div>
          ))}
        </div>
      </Section>

      <Section tone="tint" eyebrow="Triggers" title="When Keel runs" lead="Keel runs on your own GitHub Actions runners. Nothing runs on Keel's servers.">
        <Points cols={4} items={[
          { idx: "01", title: "CI fails", text: <>The <code>workflow_run</code> trigger fires when the workflow you chose finishes red.</> },
          { idx: "02", title: "Someone asks", text: <>Anyone with write access comments <code>/keel fix</code> on a pull request.</> },
          { idx: "03", title: "Fix now", text: "Press Fix now on the repository page in the Keel app." },
          { idx: "04", title: "Manually", text: <>Run the Keel workflow from the Actions tab (<code>workflow_dispatch</code>).</> },
        ]} />
      </Section>

      <Section eyebrow="The output" title="One pull request, with its reasons">
        <div className="split">
          <div>
            <p className="p-large">Every run ends in a pull request on a <code>keel/</code> branch. The label is the decision; the body is the evidence.</p>
            <ul className="bullets">
              <li>The decision, the risk score and the threshold it was compared with.</li>
              <li>The guarantee in plain words, with the calibration it came from.</li>
              <li>The reasons behind the score, and every candidate Keel considered.</li>
              <li>The run also reports back to the Keel app, so it appears on your dashboard.</li>
            </ul>
          </div>
          <div className="pr-mock">
            <div className="bar"><span className="pill auto"><span className="dot" />AUTO-MERGE</span><b>Keel fix for 1 failing test</b><span className="muted">#41</span></div>
            <div className="body">
              <div><h5>Decision</h5>Risk 0.001 is below the calibrated threshold λ̂ = 0.375 at α = 10%.</div>
              <div><h5>Why</h5><ul><li>passes 100% of the adversarial tests written by Muse Spark</li><li>the other Meta model independently reached the same behaviour</li></ul></div>
              <div><h5>Candidates</h5>
                <table><thead><tr><th>candidate</th><th>risk</th><th>attacks</th></tr></thead>
                  <tbody><tr><td>muse-spark#0 ✓</td><td>0.001</td><td>6/6</td></tr><tr><td>spark-open#4</td><td>0.001</td><td>6/6</td></tr><tr><td>spark-open#1</td><td>0.939</td><td>3/6</td></tr></tbody></table></div>
              <div className="muted" style={{ fontSize: 12.5 }}>Guarantee: on average at most 10% of bugs get a wrong fix auto-merged. Assumes new bugs resemble the calibration bugs.</div>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="tint" eyebrow="Safety rails" title="Built to fail safe">
        <Points cols={3} items={[
          { title: "Tests are off limits", text: "A candidate that edits tests, CI or .keel.toml is rejected outright, so a fix can't pass by weakening the check." },
          { title: "Secrets stay out", text: "Model-written code runs with a scrubbed environment: your repository secrets are not visible to it." },
          { title: "No calibration, no merge", text: "Without calibration data, or with a calibration made for different models or prompts, every fix goes to review." },
          { title: "Your rules still apply", text: "Auto-merge uses GitHub's own auto-merge, so branch protection and required checks are respected." },
          { title: "Label only by default", text: "Until you opt in, AUTO-MERGE is a label and a person still clicks merge." },
          { title: "Bounded runs", text: "Every test run has a timeout, and a candidate that hangs is gated out." },
        ]} />
        <p className="p-small" style={{ marginTop: 40 }}>More on data handling on the <Link to="/security">Security</Link> page.</p>
      </Section>

      <NextLinks links={[
        { to: "/guarantee", title: "The guarantee", text: "How the threshold is calibrated, and what it promises." },
        { to: "/models", title: "Meta models", text: "What each Muse model contributes to the score." },
        { to: "/docs", title: "Quickstart", text: "Connect a repository in a few minutes." },
      ]} />
    </>
  );
}
