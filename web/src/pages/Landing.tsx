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
  { title: "Generate", text: "Muse Spark and Muse Spark Open each sample candidate fixes for the failing tests." },
  { title: "Attack", text: "Muse Spark writes new tests aimed at where the candidates disagree." },
  { title: "Score", text: "Tests, locality, static analysis, agreement and model uncertainty become one risk score." },
  { title: "Decide", text: "Below the calibrated line it merges. Above it, a reviewer gets the reasons." },
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
          <span className="eyebrow">Meta Global AI Developer Hackathon</span>
          <h1 className="h-hero">Fix it. Then know if you can <span className="sig">trust it</span>.</h1>
          <p className="p-large">Keel repairs failing tests and auto-merges only the fixes it can vouch for.</p>
          <div className="ctas"><GetStarted /><Link className="btn" to="/results">See the numbers</Link></div>
          <HeroSea data={data} />
        </div></section>
      </div>

      <section className="section" id="how"><div className="wrap">
        <div className="head"><span className="eyebrow">How it works</span><h2 className="h-sec">From red CI to a decision you can defend</h2></div>
        <div className="cols steps4">
          {STEPS.map((st, i) => <div key={st.title}><div className="idx">0{i + 1}</div><h4>{st.title}</h4><p className="p-small">{st.text}</p></div>)}
        </div>
        <Link className="more" to="/how-it-works">See the full pipeline <span className="arrow">→</span></Link>
      </div></section>

      <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="head"><span className="eyebrow">Meta models</span><h2 className="h-sec">A panel of models that check each other</h2></div>
        <div className="cols models">
          <div><div className="ill"><SparkArt /></div>
            <h4>Muse Spark</h4><p className="p-small">Writes the fixes, then the tests that attack them.</p></div>
          <div><div className="ill"><OpenArt /></div>
            <h4>Muse Spark Open</h4><p className="p-small">A second opinion, plus token-level confidence only open weights expose.</p></div>
          <div><div className="ill"><GlimmerArt /></div>
            <h4>Muse Glimmer</h4><p className="p-small">Cheap triage that sets how many fixes each bug deserves.</p></div>
        </div>
        <Link className="more" to="/models">How each model is used <span className="arrow">→</span></Link>
      </div></section>

      <section className="band inv" id="guarantee" data-dark-zone><div className="wrap">
        <div className="head"><span className="eyebrow">The guarantee</span><h2 className="h-sec">A bound you can write into policy</h2>
          <p className="p-large">Pick α. Keel's error stays under it. Naive rules don't.</p></div>
        <div className="g-wrap">
          {guarantee ? <DarkStage draw={guarantee} viewBox="0 0 640 360" className="g-stage" />
            : <div className="stage g-stage dark" />}
          <div className="cols g-cols">
            <div><h4>Per bug · conformal risk control</h4><div className="f">(Σ wrong·1[s ≤ λ] + 1) / (n + 1) ≤ α</div><p className="p-small">At most α of bugs get a wrong merge, on average.</p></div>
            <div><h4>Per merge · Learn-then-Test</h4><div className="f">P(Bin(k, α) ≤ w) ≤ δ / |Λ|</div><p className="p-small">At most α of merges are wrong, with probability 1 − δ.</p></div>
          </div>
        </div>
        <p className="fine">Assumes new bugs resemble the calibration bugs. Without calibration, Keel never auto-merges.</p>
        <Link className="more" to="/guarantee">Read the guarantee <span className="arrow">→</span></Link>
      </div></section>

      <section className="section" id="compare"><div className="wrap">
        <div className="head"><span className="eyebrow">Compared</span><h2 className="h-sec">Others hand you a PR. Keel tells you which to skip.</h2></div>
        <div className="cmp"><table>
          <thead><tr><th></th><th>Fixes code</th><th>Decides alone</th><th>Error bound</th></tr></thead>
          <tbody>{COMPARE.map(([name, ...v]) => (
            <tr key={name} className={name === "Keel" ? "keel" : ""}><td>{name}</td>{v.map((y, i) => <td key={i} className={y ? "y" : "n"} aria-label={y ? "yes" : "no"} />)}</tr>
          ))}</tbody>
        </table></div>
        <Link className="more" to="/compare">Full comparison <span className="arrow">→</span></Link>
      </div></section>

      <section className="section install-band" id="start"><div className="wrap install">
        <div className="head"><span className="eyebrow">Get started</span><h2 className="h-sec">Live in three steps</h2>
          <p className="p-large">No YAML to write. Keel sets itself up with one pull request.</p>
          <div className="ctas start"><GetStarted /></div></div>
        <div className="cols steps-start">
          <div><div className="idx">01</div><h4>Sign in with GitHub</h4><p className="p-small">Install the Keel app on the repositories you choose.</p></div>
          <div><div className="idx">02</div><h4>Set your policy</h4><p className="p-small">Pick the Meta models and your risk level α.</p></div>
          <div><div className="idx">03</div><h4>Merge one pull request</h4><p className="p-small">Keel adds a workflow and a config file, then repairs failing CI on its own.</p></div>
        </div>
      </div></section>
    </div>
  );
}
