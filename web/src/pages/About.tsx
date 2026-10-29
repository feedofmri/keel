import { NextLinks, PageIntro, Points, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";
import { REPO_URL } from "../lib/env";

export default function About() {
  useTitle("About Keel");
  return (
    <>
      <PageIntro eyebrow="About" title="Built for the Meta Global AI Developer Hackathon"
        lead="Keel is an open-source code-repair agent that knows when it should not be trusted. It was built during the event, Oct 26 – Nov 4, 2026." />

      <Section eyebrow="Why" title="The bottleneck moved">
        <div className="split">
          <p className="p-large">Coding agents now write plausible fixes faster than teams can review them. The hard part is no longer generating a fix. It's deciding which fixes are safe to merge without a person.</p>
          <div className="prose">
            <p>Keel answers that with a number you can set as policy. Pick a risk level, and Keel calibrates its auto-merge threshold so that wrong auto-merges stay under it. Everything else goes to a reviewer, with the reasons.</p>
            <p>It builds on Meta's work on assured LLM-based software engineering, from SapFix to TestGen-LLM, and turns the assurance into a calibrated statistical guarantee.</p>
          </div>
        </div>
      </Section>

      <Section tone="tint" eyebrow="What's in the project" title="Built during the hackathon">
        <Points cols={3} items={[
          { title: "The engine", text: "Generation with Muse models, adversarial tests, the risk score, and conformal risk control." },
          { title: "The GitHub Action", text: "One workflow file that repairs failing CI on your own runners." },
          { title: "The platform", text: "Sign in with GitHub, connect repositories, set policy, and track every run." },
          { title: "The evaluation", text: "QuixBugs and SWE-bench Lite against naive baselines, with hidden-test labels." },
          { title: "This website", text: "The landing pages, docs, and the interactive results." },
          { title: "The demo", text: "A demo repository with real bugs, and a three-minute video." },
        ]} />
        <p className="p-small" style={{ marginTop: 32 }}>A dated record is in <a href={`${REPO_URL}/blob/main/HACKATHON.md`}>HACKATHON.md</a> and <a href={`${REPO_URL}/blob/main/BUILD_LOG.md`}>BUILD_LOG.md</a>.</p>
      </Section>

      <Section eyebrow="Open source" title="MIT licensed">
        <div className="split">
          <p className="p-large">The engine, the Action, the platform and this site are all in one public repository.</p>
          <div className="ctas start" style={{ marginTop: 0 }}><a className="btn primary" href={REPO_URL}>View on GitHub</a><a className="btn" href={`${REPO_URL}/issues`}>Open an issue</a></div>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/how-it-works", title: "How it works", text: "The pipeline, step by step." },
        { to: "/results", title: "Results", text: "The evaluation, live." },
        { to: "/security", title: "Security", text: "What Keel can and can't see." },
      ]} />
    </>
  );
}
