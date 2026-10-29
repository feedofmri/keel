import { Link } from "react-router-dom";
import { RefTable } from "../../components/Page";
import { useTitle } from "../../hooks/useTitle";
import { DocHead } from "../../layouts/DocsLayout";

export default function Concepts() {
  useTitle("Concepts · Keel Docs");
  return (
    <div className="prose">
      <DocHead group="Getting started" title="Concepts" lead="Terms used in Keel's pull requests, dashboard and settings." />
      <RefTable mono={false} head={["Term", "Meaning"]} rows={[
        [<strong>Run</strong>, "One repair attempt for a set of failing tests: generate, attack, score, decide."],
        [<strong>Candidate</strong>, "One patch from one model sample. A run has k candidates per model (10 by default)."],
        [<strong>Adversarial test</strong>, "A new test Muse Spark writes to target behaviour the candidates disagree on."],
        [<strong>Gate</strong>, "A hard rule a candidate must pass: it applies, the failing tests pass, passing tests stay green, no syntax errors, no timeouts, no edits to tests or CI."],
        [<strong>Risk score s</strong>, "A number from 0 to 1 for each candidate. Lower is safer. A failed gate means s = 1."],
        [<strong>Risk level α</strong>, "The error rate you accept, e.g. 10%. You choose it per repository."],
        [<strong>Threshold λ̂</strong>, "The largest score that still auto-merges, computed from the calibration at your α."],
        [<strong>Calibration</strong>, "Held-out bugs with their scores and hidden-test outcomes. It turns α into λ̂."],
        [<strong>Fingerprint</strong>, "A hash of the models, prompts and scorer. A calibration with a different fingerprint is refused."],
        [<strong>AUTO-MERGE / NEEDS REVIEW</strong>, "The decision, written as a label on the pull request."],
        [<strong>Wrong merge</strong>, "An auto-merged fix that was reverted, or that a maintainer marked wrong in the app."],
      ]} />
      <p>For the maths behind α and λ̂, read <Link to="/guarantee">the guarantee</Link>.</p>
    </div>
  );
}
