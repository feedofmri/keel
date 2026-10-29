import { NextLinks, PageIntro, Points, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { REPO_URL } from "../lib/env";

export default function About() {
  useTitle("About Keel");
  return (
    <>
      <PageIntro title="About Keel"
        lead="Keel is an open-source code-repair system that determines when its own fixes can be merged without review, and states how often that determination may be wrong." />

      <Section title="Purpose">
        <div className="split">
          <p className="p-large">Coding agents now produce plausible fixes faster than teams can review them. The limiting factor is no longer generating a fix, but deciding which fixes can be merged without human review.</p>
          <div className="prose">
            <p>Keel addresses this with a risk level that can be set as policy. Keel calibrates its merge threshold so that incorrect automatic merges remain at or below that level. All other changes are sent for review with an explanation.</p>
            <p>The approach builds on Meta's work on assured LLM-based software engineering, including SapFix and TestGen-LLM, and expresses that assurance as a calibrated statistical guarantee.</p>
          </div>
        </div>
      </Section>

      <Section tone="tint" title="Components">
        <Points cols={3} items={[
          { title: "Repair engine", text: "Patch generation with Muse models, adversarial testing, risk scoring and conformal risk control." },
          { title: "GitHub Action", text: "A single workflow that repairs failing CI on your own runners." },
          { title: "Platform", text: "GitHub sign-in, repository setup, policy configuration and run history." },
          { title: "Evaluation", text: "QuixBugs and SWE-bench Lite, compared with baseline policies using hidden-test labels." },
          { title: "Documentation", text: "Product documentation, configuration reference and published results." },
          { title: "Demonstration", text: "A demonstration repository with real bugs and a recorded walkthrough." },
        ]} />
        <p className="p-small" style={{ marginTop: 32 }}>Keel was developed during the Meta Global AI Developer Hackathon, 26 October to 4 November 2026. A dated record of the work is available in <a href={`${REPO_URL}/blob/main/HACKATHON.md`}>HACKATHON.md</a> and <a href={`${REPO_URL}/blob/main/BUILD_LOG.md`}>BUILD_LOG.md</a>.</p>
      </Section>

      <Section title="Licence">
        <div className="split">
          <p className="p-large">Keel is released under the MIT License. The engine, the GitHub Action, the platform and this website are maintained in a single public repository.</p>
          <div className="ctas start" style={{ marginTop: 0 }}><a className="btn primary" href={REPO_URL}>View on GitHub</a><a className="btn" href={`${REPO_URL}/issues`}>Open an issue</a></div>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/how-it-works", title: "How it works", text: "The repair pipeline in detail." },
        { to: "/results", title: "Results", text: "Evaluation results and methodology." },
        { to: "/security", title: "Security", text: "Data access and safeguards." },
      ]} />
    </>
  );
}
