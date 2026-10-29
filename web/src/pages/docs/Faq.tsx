import { Link } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

const QA: [string, React.ReactNode][] = [
  ["Does Keel see my code?", <>The repair runs on your GitHub Actions runner. The Keel app receives a summary of each run, never diffs or source. See <Link to="/security">Security</Link>.</>],
  ["Will Keel merge things on its own?", "Only if you turn on auto-merge, have a calibration, and the fix scores under the threshold. By default AUTO-MERGE is just a label."],
  ["What languages are supported?", "Python with pytest today. The pipeline is language-agnostic; other test runners are on the roadmap."],
  ["What does a run cost?", "Model usage under your own keys, typically a few cents for ten candidates. Each run's cost is on its page in the app, and totals are on the Usage page."],
  ["Why did Keel say NEEDS REVIEW on a fix that looks fine?", "Its score was above the threshold for your α, or there was no valid calibration. The PR lists the reasons. A lower-risk policy means more reviews."],
  ["A fix Keel auto-merged was wrong. What now?", <>Revert it, or mark it wrong on the run page in the app. Both count against the risk budget on the <Link to="/app/calibration">Calibration</Link> page.</>],
  ["Can I use other models?", "Any OpenAI-compatible endpoint works through the same client; the Meta Muse models are the defaults Keel is calibrated for. A new model means a new calibration."],
  ["How do I stop Keel?", "Pause the repository in the app (it disables the workflow), delete the workflow file, or uninstall the GitHub App."],
];

export default function Faq() {
  useTitle("FAQ · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Help" title="FAQ" lead="Short answers to the questions people ask first." />
      {QA.map(([q, a]) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}
    </div>
  );
}
