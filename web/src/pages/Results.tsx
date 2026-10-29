import { useState } from "react";
import { Chart } from "../components/Chart";
import { Segmented } from "../components/Segmented";
import { useTitle } from "../hooks/useTitle";
import { crcThreshold, lttThreshold, NEVER, pct, stats } from "../lib/conformal";
import { MODEL_NAMES } from "../lib/format";
import { useResults, type Results as R } from "../lib/results";
import { histogram, lineChart, type Series } from "../visuals/charts";
import "../styles/results.css";

const SERIES: Record<string, { name: string; color: string; width: number }> = {
  keel_crc: { name: "Keel · CRC", color: "--series-1", width: 2.5 },
  keel_ltt: { name: "Keel · LTT", color: "--series-2", width: 2.5 },
  tests_pass: { name: "Merge if tests pass", color: "--series-3", width: 2 },
  self_confidence: { name: "Model self-confidence ≥ 1−α", color: "--series-4", width: 2 },
  uncalibrated_score: { name: "Keel score, no calibration", color: "--series-5", width: 2 },
};
const AXIS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
type Method = "crc" | "ltt"; type Metric = "risk" | "fdr";

function Legend({ items }: { items: Series[] }) {
  return <div className="legend">{items.map(s => <span key={s.key}><i className={s.dash ? "dash" : ""} style={s.dash ? undefined : { background: `var(${s.color})` }} />{s.name}</span>)}</div>;
}

export default function Results() {
  useTitle("Keel Results");
  const { data, error } = useResults();
  const [alpha, setAlpha] = useState(0.1);
  const [method, setMethod] = useState<Method>("crc");
  const thr = data ? (method === "crc" ? crcThreshold(data.slider.cal, alpha) : lttThreshold(data.slider.cal, alpha, data.evaluation.delta || 0.1)) : NEVER;
  return (
    <div className="page-results">
      <div className="wrap">
        <section className="band inv" data-dark-zone style={{ padding: "104px 0 56px", marginTop: -64 }}>
          <div className="eyebrow">Benchmark results</div>
          <h1 className="h-hero" style={{ margin: "18px 0 12px" }}>How much can Keel safely auto-merge?</h1>
          <p className="p-large" style={{ margin: "0 0 28px" }}>Pick a risk level. See what Keel merges, and how often it's wrong.</p>
          {error && <div className="banner">Could not load results: {error}</div>}
          {data ? <Explorer data={data} alpha={alpha} setAlpha={setAlpha} method={method} setMethod={setMethod} thr={thr} />
            : !error && <p className="muted">Loading results…</p>}
        </section>
        {data && <Details data={data} alpha={alpha} thr={thr} />}
      </div>
    </div>
  );
}

interface ExplorerProps { data: R; alpha: number; setAlpha: (a: number) => void; method: Method; setMethod: (m: Method) => void; thr: number }

/** Slider, guarantee switch and the four KPI tiles for one fixed calibration/test split. */
function Explorer({ data, alpha, setAlpha, method, setMethod, thr }: ExplorerProps) {
  const ev = data.evaluation, cal = data.slider.cal, delta = ev.delta || 0.1;
  const st = stats(data.slider.test, thr);
  const near = (f: Metric) => {
    const rows = ev.methods[`keel_${method}`] || []; let r = rows[0];
    for (const x of rows) if (Math.abs(x.alpha - alpha) < Math.abs(r.alpha - alpha)) r = x;
    return r ? `${pct(r[f], 1)} at α = ${pct(r.alpha)}` : "–";
  };
  return (
    <>
      {data.simulated && <div className="banner" style={{ marginBottom: 18 }}>Preview: simulated evaluation data. Real QuixBugs and SWE-bench Lite results replace it after the benchmark runs.</div>}
      <section className="card controls">
        <div className="slider-row">
          <label htmlFor="alpha"><span>Risk level α</span><span>{pct(alpha)}</span></label>
          <input id="alpha" type="range" min={0.01} max={0.5} step={0.01} value={alpha} onChange={e => setAlpha(+e.target.value)} />
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>Guarantee</div>
          <Segmented label="Guarantee" value={method} onChange={setMethod} options={[["crc", "CRC · per bug"], ["ltt", "LTT · per merge"]]} />
        </div>
      </section>
      <section className="grid tiles" aria-live="polite">
        <div className="card tile"><div className="label">Auto-merge threshold λ̂</div><div className="value">{thr > NEVER ? thr.toFixed(3) : "none"}</div>
          <div className="sub">{thr > NEVER ? "risk score at or below this merges" : `can't certify α with ${cal.length} calibration bugs`}</div></div>
        <div className="card tile"><div className="label">Bugs auto-merged</div><div className="value">{pct(st.merge)}</div><div className="sub">{st.k} of {st.n} held-out bugs</div></div>
        <div className="card tile"><div className="label">Wrong auto-merges</div><div className="value">{pct(st.risk, 1)}</div><div className="sub">this split · mean over splits {near("risk")}</div></div>
        <div className="card tile"><div className="label">Wrong among merged</div><div className="value">{st.k ? pct(st.fdr, 1) : "–"}</div>
          <div className="sub">{method === "ltt" ? `bound α w.p. ${pct(1 - delta)} · mean ${near("fdr")}` : `this split · mean ${near("fdr")}`}</div></div>
      </section>
      <p className="sentence">{thr > NEVER
        ? <>On this split Keel would auto-merge <b>{st.k}</b> of {st.n} held-out bugs, and <b>{st.w}</b> of those merges would be wrong. Everything else goes to a human with an explanation.</>
        : <>At α = {pct(alpha)} Keel cannot certify any threshold with {cal.length} calibration bugs, so every fix goes to human review. That is the safe default.</>}</p>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>One fixed split shown; the bound holds on average across splits (charts below).</p>
    </>
  );
}

/** Mean behaviour over many splits, the score histogram, and the model and ablation tables. */
function Details({ data, alpha, thr }: { data: R; alpha: number; thr: number }) {
  const [metric, setMetric] = useState<Metric>("risk");
  const ev = data.evaluation, methods = ev.methods;
  const order = ["keel_crc", "keel_ltt", "tests_pass", "self_confidence", "uncalibrated_score"].filter(k => methods[k]);
  const ser: Series[] = order.map(k => ({ key: k, ...SERIES[k], points: methods[k].map(r => [r.alpha, r[metric]] as [number, number]), label: k.startsWith("keel") ? SERIES[k].name : "" }));
  ser.push({ key: "bound", name: "Guaranteed bound (y = α)", dash: "6 5", width: 1.5, points: ev.alphas.map(x => [x, x] as [number, number]) });
  const ymax = Math.min(1, Math.max(0.5, ...ser.flatMap(s => s.points.map(p => p[1]))) * 1.05);
  const mser: Series[] = ["keel_crc", "keel_ltt"].filter(k => methods[k]).map(k => ({ key: k, ...SERIES[k], points: methods[k].map(r => [r.alpha, r.merge] as [number, number]), label: SERIES[k].name }));
  if (methods.oracle) mser.push({ key: "oracle", name: "Oracle (merges exactly the correct fixes)", dash: "6 5", width: 1.5, points: methods.oracle.map(r => [r.alpha, r.merge] as [number, number]) });
  return (
    <>
      <section className="grid two">
        <div className="card">
          <p className="chart-title">{metric === "risk" ? "Wrong auto-merges per bug vs. the bound" : "Wrong share among auto-merged vs. the bound"}</p>
          <p className="chart-sub">{data.n_bugs} bugs ({data.datasets.join(", ")}), mean over {ev.n_splits} random calibration/test splits.</p>
          <div style={{ marginBottom: 8 }}><Segmented label="Error metric" value={metric} onChange={setMetric} options={[["risk", "Wrong merges per bug"], ["fdr", "Wrong among merged"]]} /></div>
          <Chart deps={[metric, alpha, data]} draw={h => lineChart(h, ser, { label: "Empirical error versus risk level", xmax: 0.5, ymax, marker: alpha, labelRoom: 84, yticks: AXIS.filter(t => t <= ymax), xticks: AXIS })} />
          <Legend items={ser} />
          <details><summary>Show as table</summary><div className="table-scroll"><table className="data">
            <thead><tr><th>α</th>{order.map(k => <th key={k} className="num">{SERIES[k].name}</th>)}</tr></thead>
            <tbody>{ev.alphas.map((a, i) => <tr key={a}><td>{pct(a)}</td>{order.map(k => <td key={k} className="num">{pct(methods[k][i][metric], 1)}</td>)}</tr>)}</tbody>
          </table></div></details>
        </div>
        <div className="card">
          <p className="chart-title">Risk scores of selected patches</p>
          <p className="chart-sub">Held-out bugs. Patches left of the line are auto-merged.</p>
          <Chart deps={[thr, data]} draw={h => histogram(h, data.slider.test, thr)} />
          <div className="legend"><span><i style={{ background: "var(--series-1)" }} />Correct (passes hidden tests)</span><span><i style={{ background: "var(--series-2)" }} />Wrong</span><span><i className="dash" />Threshold</span></div>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <p className="chart-title">Share of bugs auto-merged</p>
          <p className="chart-sub">Higher is better, as long as the error stays under the bound. The oracle merges exactly the correct fixes.</p>
          <Chart deps={[alpha, data]} draw={h => lineChart(h, mser, { label: "Auto-merge rate versus risk level", xmax: 0.5, ymax: 1, marker: alpha, labelRoom: 84, yticks: [0, 0.25, 0.5, 0.75, 1], xticks: AXIS })} />
          <Legend items={mser} />
        </div>
        <div className="card">
          <p className="chart-title">Meta models compared <span className="muted" style={{ fontWeight: 400 }}>(α = 10%)</span></p>
          <div className="table-scroll"><table className="data">
            <thead><tr><th>Models</th><th className="num">Solve@k</th><th className="num">Score AUROC</th><th className="num">Auto-merged</th><th className="num">$ / auto-merge</th></tr></thead>
            <tbody>{(data.models || []).map(r => <tr key={r.models}>
              <td>{r.models.includes("+") ? "All together" : MODEL_NAMES[r.models] || r.models}</td><td className="num">{pct(r.solve_at_k)}</td>
              <td className="num">{r.auroc == null ? "–" : r.auroc.toFixed(2)}</td><td className="num">{pct(r.merge_rate)}</td>
              <td className="num">{r.cost_per_auto_merge == null ? "–" : "$" + r.cost_per_auto_merge.toFixed(3)}</td></tr>)}</tbody>
          </table></div>
          <p className="chart-title" style={{ marginTop: 18 }}>What each signal is worth</p>
          <p className="chart-sub">Auto-merge rate at α = 10% when a feature group is removed.</p>
          <div className="table-scroll"><table className="data">
            <thead><tr><th>Removed</th><th className="num">Auto-merged</th><th className="num">Error</th></tr></thead>
            <tbody>{(data.ablations || []).map(r => <tr key={r.removed}><td>{r.removed.replaceAll("_", " ")}</td><td className="num">{pct(r.merge_rate)}</td><td className="num">{pct(r.risk, 1)}</td></tr>)}</tbody>
          </table></div>
        </div>
      </section>
    </>
  );
}
