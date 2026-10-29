import { NextLinks, PageIntro, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";

type Mark = "y" | "p" | "n";
const COLS = ["Writes the fix", "Tests its own fix adversarially", "Decides without a human", "Calibrated error bound", "Explains the decision", "Open source"];
const ROWS: [string, Mark[], string][] = [
  ["Copilot “Fix with Copilot”", ["y", "n", "n", "n", "p", "n"], "One click on a failed Actions job; Copilot pushes a fix and tags you for review."],
  ["Sentry Seer", ["y", "n", "n", "n", "y", "n"], "Finds the root cause from production telemetry, then hands off to Copilot for a PR."],
  ["Devin, Cursor agents, Codex", ["y", "p", "n", "n", "p", "n"], "General coding agents. Their PRs merge far less often than human PRs: the trust gap Keel targets."],
  ["OpenHands (critic)", ["y", "n", "n", "n", "n", "y"], "A learned critic ranks rollouts, but doesn't say whether the best one can be trusted."],
  ["Agentless", ["y", "p", "n", "n", "n", "y"], "Filters by regression tests and picks by consensus. Always submits a patch; no abstention."],
  ["Renovate Merge Confidence", ["n", "n", "y", "n", "p", "p"], "Auto-merges dependency bumps from crowd data. Can't judge new code; no statistical bound."],
  ["Keel", ["y", "y", "y", "y", "y", "y"], "Generates, attacks and scores fixes, then auto-merges only under a calibrated risk bound you choose."],
];

export default function Compare() {
  useTitle("Keel Compared");
  return (
    <>
      <PageIntro eyebrow="Compared" title="Others hand you a PR. Keel tells you which to skip."
        lead="Most tools stop at “here's a fix, please review”. Keel's output is a decision, with a bound on how often it's wrong." />

      <Section eyebrow="Side by side" title="Where each tool stops">
        <div className="cmp-full"><table>
          <thead><tr><th></th>{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{ROWS.map(([name, marks]) => (
            <tr key={name} className={name === "Keel" ? "keel" : ""}><td>{name}</td>{marks.map((m, i) => <td key={i} className={m} aria-label={{ y: "yes", p: "partly", n: "no" }[m]} />)}</tr>
          ))}</tbody>
        </table></div>
        <div className="legend-inline"><span><span className="sig">●</span> yes</span><span><span style={{ color: "var(--review)" }}>◐</span> partly</span><span>— no</span></div>
      </Section>

      <Section tone="tint" eyebrow="In detail" title="What each one does">
        <div className="cards c2">
          {ROWS.map(([name, , text]) => <div className="card-x" key={name}><h3 style={{ marginTop: 0 }}>{name}</h3><p className="p-small">{text}</p></div>)}
        </div>
      </Section>

      <Section eyebrow="Better together" title="Keel can be the trust layer for other agents">
        <div className="split">
          <p className="p-large">Keel's guarantee doesn't depend on who wrote the patch. A stronger generator raises the auto-merge rate without loosening the bound.</p>
          <ul className="bullets">
            <li>Where others are ahead today: raw solve rate on hard repository-level bugs, and root-cause analysis from production telemetry.</li>
            <li>Keel starts from failing tests, and reports solve rate per Meta model honestly on the Results page.</li>
            <li>Sources for every claim are in the <a href="https://github.com/feedofmri/keel/blob/main/docs/competitive-landscape.md">competitive landscape notes</a>.</li>
          </ul>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/guarantee", title: "The guarantee", text: "What “calibrated error bound” means here." },
        { to: "/results", title: "Results", text: "Keel against naive auto-merge rules." },
        { to: "/docs", title: "Quickstart", text: "Try it on a repository." },
      ]} />
    </>
  );
}
