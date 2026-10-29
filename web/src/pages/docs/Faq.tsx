import { Link } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

const QA: [string, React.ReactNode][] = [
  ["Does Keel have access to my source code?", <>The repair runs on your GitHub Actions runner. The Keel service receives a summary of each run, but never diffs or source code. See <Link to="/security">Security</Link>.</>],
  ["Does Keel merge changes automatically?", "Only when automatic merging is enabled, a valid calibration is present and the patch scores below the threshold. By default, AUTO-MERGE is a label only."],
  ["What languages are supported?", "Python projects tested with pytest are currently supported. The pipeline is language-independent, and support for other test runners is planned."],
  ["What does a run cost?", "Model usage is billed to your own keys and typically amounts to a few cents for ten candidates. The cost of each run is shown on its page, and totals are shown on the Usage page."],
  ["Why was an apparently correct fix labelled NEEDS REVIEW?", "Its score was above the threshold for the configured α, or no valid calibration was available. The pull request lists the reasons. A lower risk level results in more reviews."],
  ["What should I do if an automatically merged fix is incorrect?", <>Revert the pull request, or mark the run as incorrect on its page. Both are counted against the risk budget on the <Link to="/app/calibration">Calibration</Link> page.</>],
  ["Can other models be used?", "Any OpenAI-compatible endpoint can be used through the same client. Keel is calibrated for the Meta Muse models; a different model requires a new calibration."],
  ["How can Keel be stopped?", "Pause the repository in the application (which disables the workflow), delete the workflow file, or uninstall the GitHub App."],
];

export default function Faq() {
  useTitle("FAQ · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Help" title="FAQ" lead="Answers to frequently asked questions." />
      {QA.map(([q, a]) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}
    </div>
  );
}
