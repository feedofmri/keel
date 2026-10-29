import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { DarkStage } from "../components/DarkStage";
import { GetStarted } from "../components/GetStarted";
import { HeroSea } from "../components/HeroSea";
import { GlimmerArt, OpenArt, SparkArt } from "../components/ModelArt";
import { useTitle } from "../hooks/useTitle";
import { useResults } from "../lib/results";
import { drawGuarantee } from "../visuals/stages";
import "../styles/landing.css";

const STEPS = [
  { title: "Generate", text: "Muse Spark and Muse Spark Open each produce candidate patches for the failing tests." },
  { title: "Attack", text: "Muse Spark writes additional tests that target the behaviour on which the candidates disagree." },
  { title: "Score", text: "Test results, patch locality, static analysis, model agreement and model uncertainty are combined into one risk score." },
  { title: "Decide", text: "Patches below the calibrated threshold are approved for merge. All others are sent for review with an explanation." },
];
const COMPARE: [string, boolean, boolean, boolean][] = [
  ["Copilot “Fix with Copilot”", true, false, false], ["Sentry Seer", true, false, false], ["OpenHands, Agentless", true, false, false],
  ["Renovate Merge Confidence", false, true, false], ["Keel", true, true, true],
];

export default function Landing() {
  useTitle("Keel");
  const { data } = useResults();
  const { hash } = useLocation();
  const guarantee = useMemo(() => (data ? drawGuarantee(data) : null), [data]);

  // In-page links (/#how) still work: scroll once the section exists.
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="page-landing">
      <div className="inv" data-dark-zone>
        <section className="hero"><div className="wrap">
          <h1 className="h-hero">Automated code repair with a <span className="sig">calibrated error rate</span></h1>
          <p className="p-large">Keel repairs failing tests and approves only the fixes that meet the risk level you set.</p>
          <div className="ctas"><GetStarted /><Link className="btn" to="/results">View results</Link></div>
          <HeroSea data={data} />
        </div></section>
      </div>

      <section className="section" id="how"><div className="wrap">
        <div className="head"><h2 className="h-sec">How Keel works</h2></div>
        <div className="cols steps4">
          {STEPS.map((st, i) => <div key={st.title}><div className="idx">0{i + 1}</div><h4>{st.title}</h4><p className="p-small">{st.text}</p></div>)}
        </div>
        <Link className="more" to="/how-it-works">Read about the pipeline <span className="arrow">→</span></Link>
      </div></section>

      <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="head"><h2 className="h-sec">Meta models</h2></div>
        <div className="cols models">
          <div><div className="ill"><SparkArt /></div>
            <h4>Muse Spark</h4><p className="p-small">Generates candidate patches and the adversarial tests used to evaluate them.</p></div>
          <div><div className="ill"><OpenArt /></div>
            <h4>Muse Spark Open</h4><p className="p-small">Produces an independent set of patches and token-level confidence signals available from open-weight models.</p></div>
          <div><div className="ill"><GlimmerArt /></div>
            <h4>Muse Glimmer</h4><p className="p-small">Estimates the difficulty of each bug and sets the number of candidates to generate.</p></div>
        </div>
        <Link className="more" to="/models">How each model is used <span className="arrow">→</span></Link>
      </div></section>

      <section className="band inv" id="guarantee" data-dark-zone><div className="wrap">
        <div className="head"><h2 className="h-sec">A statistical guarantee on merge errors</h2>
          <p className="p-large">You select a risk level α. Keel calibrates its threshold so that incorrect automatic merges stay at or below α.</p></div>
        <div className="g-wrap">
          {guarantee ? <DarkStage draw={guarantee} viewBox="0 0 640 360" className="g-stage" />
            : <div className="stage g-stage dark" />}
          <div className="cols g-cols">
            <div><h4>Per bug · conformal risk control</h4><div className="f">(Σ wrong·1[s ≤ λ] + 1) / (n + 1) ≤ α</div><p className="p-small">On average, no more than α of bugs receive an incorrect automatic merge.</p></div>
            <div><h4>Per merge · Learn-then-Test</h4><div className="f">P(Bin(k, α) ≤ w) ≤ δ / |Λ|</div><p className="p-small">With probability at least 1 − δ, no more than α of automatic merges are incorrect.</p></div>
          </div>
        </div>
        <p className="fine">The guarantee assumes that new bugs are comparable to the calibration set. Without calibration data, Keel does not merge automatically.</p>
        <Link className="more" to="/guarantee">Read about the guarantee <span className="arrow">→</span></Link>
      </div></section>

      <section className="section" id="compare"><div className="wrap">
        <div className="head"><h2 className="h-sec">Comparison with other tools</h2></div>
        <div className="cmp"><table>
          <thead><tr><th></th><th>Generates fixes</th><th>Approves without review</th><th>Calibrated error bound</th></tr></thead>
          <tbody>{COMPARE.map(([name, ...v]) => (
            <tr key={name} className={name === "Keel" ? "keel" : ""}><td>{name}</td>{v.map((y, i) => <td key={i} className={y ? "y" : "n"} aria-label={y ? "yes" : "no"} />)}</tr>
          ))}</tbody>
        </table></div>
        <Link className="more" to="/compare">Full comparison <span className="arrow">→</span></Link>
      </div></section>

      <section className="section install-band" id="start"><div className="wrap install">
        <div className="head"><h2 className="h-sec">Getting started</h2>
          <p className="p-large">Keel is configured through a single pull request. No manual workflow configuration is required.</p>
          <div className="ctas start"><GetStarted /></div></div>
        <div className="cols steps-start">
          <div><div className="idx">01</div><h4>Sign in with GitHub</h4><p className="p-small">Install the Keel GitHub App on the repositories you select.</p></div>
          <div><div className="idx">02</div><h4>Configure the policy</h4><p className="p-small">Select the Meta models and the risk level α.</p></div>
          <div><div className="idx">03</div><h4>Merge the setup pull request</h4><p className="p-small">Keel adds a workflow and a configuration file, then responds to failing CI automatically.</p></div>
        </div>
      </div></section>
    </div>
  );
}
