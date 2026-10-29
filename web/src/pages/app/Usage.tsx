import { useState } from "react";
import { Bars } from "../../components/app/Bars";
import { Loading } from "../../components/app/Empty";
import { PageHead } from "../../components/PageHead";
import { Segmented } from "../../components/Segmented";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { MODEL_NAMES } from "../../lib/format";

export default function Usage() {
  useTitle("Usage · Keel");
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const { data, error } = useAsync(() => api.usage(+days), [days]);
  const runs = data?.daily.reduce((s, d) => s + d.runs, 0) ?? 0, cost = data?.daily.reduce((s, d) => s + d.cost, 0) ?? 0;
  const merged = data?.daily.reduce((s, d) => s + d.auto_merged, 0) ?? 0;
  return (
    <>
      <PageHead title="Usage" sub="Model spend under your own keys, and the review work Keel removed." actions={
        <Segmented label="Period" value={days} onChange={setDays} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]} />} />
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : (
        <>
          <div className="kpis">
            <div><div className="k">Model cost</div><div className="v">${cost.toFixed(2)}</div><div className="s">last {days} days</div></div>
            <div><div className="k">Runs</div><div className="v">{runs}</div><div className="s">${runs ? (cost / runs).toFixed(3) : "0"} per run</div></div>
            <div><div className="k">Auto-merged</div><div className="v">{merged}</div><div className="s">reviews you didn't do</div></div>
            <div><div className="k">Cost per auto-merge</div><div className="v">${merged ? (cost / merged).toFixed(2) : "–"}</div><div className="s">all runs ÷ merges</div></div>
          </div>
          <div className="panel-box" style={{ marginTop: 40 }}>
            <h3>Daily model cost</h3>
            <Bars data={data.daily} value={d => d.cost} label={d => `$${d.cost.toFixed(3)} · ${d.runs} run(s)`} />
          </div>
          <div className="grid2" style={{ marginTop: 16 }}>
            <div className="panel-box"><h3>By repository</h3>
              {data.byRepo.length ? <table className="data" style={{ marginTop: 10 }}><thead><tr><th>Repository</th><th className="num">Runs</th><th className="num">Merged</th><th className="num">Cost</th></tr></thead>
                <tbody>{data.byRepo.map(r => <tr key={r.repo}><td>{r.repo}</td><td className="num">{r.runs}</td><td className="num">{r.auto_merged}</td><td className="num">${r.cost.toFixed(2)}</td></tr>)}</tbody></table>
                : <p className="p-small">No runs in this period.</p>}</div>
            <div className="panel-box"><h3>By model</h3>
              {data.byModel.length ? <table className="data" style={{ marginTop: 10 }}><thead><tr><th>Model</th><th className="num">Candidates</th><th className="num">Selected</th><th className="num">Cost</th></tr></thead>
                <tbody>{data.byModel.map(m => <tr key={m.model}><td>{MODEL_NAMES[m.model] || m.model}</td><td className="num">{m.candidates}</td><td className="num">{m.selected}</td><td className="num">${m.cost.toFixed(2)}</td></tr>)}</tbody></table>
                : <p className="p-small">No candidate details in this period.</p>}</div>
          </div>
        </>
      )}
    </>
  );
}
