import { NextLinks, PageIntro, Section } from "../components/Page";
import { useTitle } from "../hooks/useTitle";

type Mark = "y" | "p" | "n";
const COLS = ["Writes the fix", "Tests its own fix adversarially", "Decides without a human", "Calibrated error bound", "Explains the decision", "Open source"];
const ROWS: [string, Mark[], string][] = [
  ["Copilot “Fix with Copilot”", ["y", "n", "n", "n", "p", "n"], "Starts from a failed Actions job; Copilot pushes a fix and requests a review."],
  ["Sentry Seer", ["y", "n", "n", "n", "y", "n"], "Identifies the root cause from production telemetry, then hands off to Copilot to open a pull request."],
  ["Devin, Cursor agents, Codex", ["y", "p", "n", "n", "p", "n"], "General-purpose coding agents. Their pull requests are merged considerably less often than those written by people."],
  ["OpenHands (critic)", ["y", "n", "n", "n", "n", "y"], "A learned critic ranks candidate solutions but does not indicate whether the best one can be trusted."],
  ["Agentless", ["y", "p", "n", "n", "n", "y"], "Filters by regression tests and selects by consensus. It always submits a patch and does not abstain."],
  ["Renovate Merge Confidence", ["n", "n", "y", "n", "p", "p"], "Merges dependency updates automatically based on aggregated data. It does not evaluate new code and provides no statistical bound."],
  ["Keel", ["y", "y", "y", "y", "y", "y"], "Generates, tests and scores patches, and merges automatically only within a calibrated risk bound that you set."],
];

export default function Compare() {
  useTitle("Keel Compared");
  return (
    <>
      <PageIntro title="Keel compared with other tools"
        lead="Most tools propose a patch and request a review. Keel issues a decision and states a bound on how often that decision is incorrect." />

      <Section title="Capabilities">
        <div className="cmp-full"><table>
          <thead><tr><th></th>{COLS.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{ROWS.map(([name, marks]) => (
            <tr key={name} className={name === "Keel" ? "keel" : ""}><td>{name}</td>{marks.map((m, i) => <td key={i} className={m} aria-label={{ y: "yes", p: "partly", n: "no" }[m]} />)}</tr>
          ))}</tbody>
        </table></div>
        <div className="legend-inline"><span><span className="sig">●</span> yes</span><span><span style={{ color: "var(--review)" }}>◐</span> partly</span><span>— no</span></div>
      </Section>

      <Section tone="tint" title="Tool summaries">
        <div className="cards c2">
          {ROWS.map(([name, , text]) => <div className="card-x" key={name}><h3 style={{ marginTop: 0 }}>{name}</h3><p className="p-small">{text}</p></div>)}
        </div>
      </Section>

      <Section title="Working alongside other agents">
        <div className="split">
          <p className="p-large">Keel's guarantee does not depend on how a patch was produced. A stronger generator increases the automatic merge rate without weakening the bound.</p>
          <ul className="bullets">
            <li>Other tools currently lead on solve rate for complex repository-level bugs and on root-cause analysis from production telemetry.</li>
            <li>Keel starts from failing tests and reports the solve rate of each Meta model on the Results page.</li>
            <li>Sources for each statement are listed in the <a href="https://github.com/feedofmri/keel/blob/main/docs/competitive-landscape.md">competitive landscape notes</a>.</li>
          </ul>
        </div>
      </Section>

      <NextLinks links={[
        { to: "/guarantee", title: "The guarantee", text: "The meaning of a calibrated error bound." },
        { to: "/results", title: "Results", text: "Keel compared with baseline merge policies." },
        { to: "/docs", title: "Quickstart", text: "Set up Keel on a repository." },
      ]} />
    </>
  );
}
