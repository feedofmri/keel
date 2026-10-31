import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHead, RepoCrumbs, RepoTabs } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useRepoName } from "../../hooks/useRepoName";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { crcThreshold, stats } from "../../lib/conformal";
import { MODEL_NAMES, repoPath } from "../../lib/format";
import { KEYS } from "../../lib/modelKeys";
import { useResults } from "../../lib/results";
import type { RepoDetail, SetupSettings } from "../../lib/types";

const MODELS: [string, string][] = [
  ["muse-spark", "Generates patches and the adversarial tests used to evaluate them. Meta Model API."],
  ["muse-spark-open", "Independent second generator with token-level confidence signals. Open weights on Baseten."],
  ["muse-glimmer", "Optional low-cost triage. Open weights."],
];
const STEPS = ["Detect", "Models", "Policy", "Activate"];

/**
 * Setup for a new repository, and the Settings tab for one that is already set up. Both end in
 * one pull request that writes the workflow and .keel.toml; keys go to encrypted repository secrets.
 */
export default function RepoSettings() {
  const full = useRepoName();
  const repo = useAsync(() => api.repo(full), [full]);
  const current = repo.data?.repo;
  const setupMode = !current || current.status === "new";
  useTitle(`${setupMode ? "Set up" : "Settings"} · ${full} · Keel`);
  return (
    <>
      <PageHead crumbs={<RepoCrumbs full={full} />} title={setupMode ? "Set up Keel" : "Settings"} />
      {!setupMode && <RepoTabs full={full} canManage={current!.canManage} />}
      {repo.error ? <p className="err">{repo.error}</p>
        : !repo.data ? <p className="muted">Loading…</p>
        : <Wizard full={full} current={setupMode ? null : current!} />}
      {!setupMode && current && <RepoDanger full={full} paused={current.status === "paused"} onChange={repo.reload} />}
    </>
  );
}

function RepoDanger({ full, paused, onChange }: { full: string; paused: boolean; onChange: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(""), [confirm, setConfirm] = useState(""), [err, setErr] = useState("");
  const run = async (a: "pause" | "resume" | "disconnect") => { setBusy(a); setErr("");
    try { await api.action(full, a); if (a === "disconnect") navigate("/app/repos"); else onChange(); } catch (e) { setErr((e as Error).message); }
    setBusy(""); };
  return (
    <div style={{ marginTop: 64 }}>
      <div className="section-h"><h2>Danger zone</h2></div>
      <div className="panel-box">
        <h3>{paused ? "Resume Keel" : "Pause Keel"}</h3>
        <p className="p-small">{paused ? "Re-enable the Keel workflow on GitHub." : "Disables the Keel workflow on GitHub. No runs take place until Keel is resumed. Settings and history are retained."}</p>
        <div className="row-actions"><button className="btn" disabled={!!busy} onClick={() => run(paused ? "resume" : "pause")}>{busy === "pause" || busy === "resume" ? "Working…" : paused ? "Resume" : "Pause"}</button></div>
      </div>
      <div className="panel-box danger">
        <h3>Disconnect from Keel</h3>
        <p className="p-small">Deletes this repository's runs and activity from Keel. The workflow file remains in the repository until it is removed, and the GitHub App retains access until the repository is removed from the installation.</p>
        <div className="field" style={{ maxWidth: 360 }}><label htmlFor="dc">Type <b>{full}</b> to confirm</label><input id="dc" type="text" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" /></div>
        <div className="row-actions"><button className="btn danger-btn" disabled={!!busy || confirm !== full} onClick={() => run("disconnect")}>{busy === "disconnect" ? "Disconnecting…" : "Disconnect"}</button></div>
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

function Wizard({ full, current }: { full: string; current: RepoDetail | null }) {
  const det = useAsync(() => api.detect(full), [full]);
  const defaults = useAsync(() => api.defaults(), []);
  const shared = useAsync(() => api.sharedCalibration(), []);
  const savedList = useAsync(() => api.savedKeys(), []);
  const saved = Object.fromEntries((savedList.data || []).map(k => [k.name, k]));
  const { data: results } = useResults();
  const [step, setStep] = useState(0);
  const [install, setInstall] = useState("");
  const [ci, setCi] = useState<string>("");
  const [models, setModels] = useState<string[]>(current?.models || ["muse-spark", "muse-spark-open"]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [alpha, setAlpha] = useState(current?.alpha ?? 0.1);
  const [method, setMethod] = useState<"crc" | "ltt">(current?.method || "crc");
  const [autoMerge, setAutoMerge] = useState(current?.autoMerge ?? false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: number; url: string; stored: number; fromAccount: number } | null>(null);

  // A new repository starts from the account defaults (Settings → Defaults).
  useEffect(() => {
    if (current || !defaults.data) return;
    setAlpha(defaults.data.alpha); setMethod(defaults.data.method); setAutoMerge(defaults.data.autoMerge); setModels(defaults.data.models);
  }, [defaults.data, current]);
  useEffect(() => {
    if (!det.data) return;
    setInstall(det.data.installCommand);
    setCi(current?.ciWorkflow ?? det.data.ciWorkflow ?? "");
  }, [det.data, current]);

  const go = (i: number) => { setStep(Math.max(0, Math.min(STEPS.length - 1, i))); scrollTo({ top: 0, behavior: "smooth" }); };
  const settings = (): SetupSettings => {
    const allowed = new Set(models.flatMap(m => KEYS[m].map(k => k[0])));
    // A blank field with a key saved in Settings → Model keys is filled in by the server from the account.
    const vals = Object.fromEntries(models.flatMap(m => KEYS[m].map(([id, , , def]) => [id, keys[id] ?? (saved[id] ? "" : def)])));
    return { alpha, method, autoMerge, models, ciWorkflow: ci || null, installCommand: install.trim(),
      secrets: Object.fromEntries(Object.entries(vals).filter(([k, v]) => allowed.has(k) && v.trim())) };
  };
  const preview = useMemo(() => {
    if (!results) return null;
    const thr = crcThreshold(results.slider.cal, alpha);
    return thr < 0 ? null : Math.round(stats(results.slider.test, thr).merge * 100);
  }, [results, alpha]);

  const activate = async () => {
    const s = settings(); setErr("");
    if (!s.models.length) { setErr("Choose at least one model."); return; }
    setBusy(true);
    try { const r = await api.setup(full, s); setDone({ ...r.pr, stored: r.secretsStored.length, fromAccount: r.fromAccount.length }); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const Nav = ({ last }: { last?: boolean }) => (
    <div className="nav-steps">
      {step > 0 && <button className="btn" onClick={() => go(step - 1)}>Back</button>}
      {!last && <button className="btn primary" onClick={() => go(step + 1)}>Continue <span className="arrow">→</span></button>}
    </div>
  );

  return (
    <div className="wizard">
      <nav className="rail" aria-label="Setup steps">
        {STEPS.map((t, i) => (
          <button key={t} onClick={() => go(i)} className={i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
            <span className="n">{i + 1}</span>{t}</button>
        ))}
      </nav>
      <div>
        {step === 0 && <section className="panel-step on">
          <h2>Detected configuration</h2>
          <p className="p-small">Keel has read the repository's file list and workflows. Review the detected values and correct them if necessary.</p>
          {det.error ? <p className="err">{det.error}</p> : !det.data
            ? <div className="found"><div><div className="k">Reading repository</div><div className="v"><span className="live">detecting</span></div></div></div>
            : <>
              <div className="found">
                <div><div className="k">Language</div><div className="v">{det.data.language}</div></div>
                <div><div className="k">Tests</div><div className="v">pytest</div></div>
                <div><div className="k">CI workflow</div><div className="v">{det.data.ciWorkflow || "none found"}</div></div>
              </div>
              <div className="field"><label htmlFor="install">Install command (runs before Keel, as in your CI)</label>
                <input type="text" id="install" value={install} onChange={e => setInstall(e.target.value)} /></div>
              <div className="field"><label htmlFor="ci">Run Keel when this workflow fails</label>
                <select id="ci" value={ci} onChange={e => setCi(e.target.value)}>
                  {det.data.workflows.map(w => <option key={w} value={w}>{w}</option>)}<option value="">None (on demand only)</option>
                </select>
                <span className="hint">Keel also runs in response to <code>/keel fix</code> comments and on request.</span></div>
              {det.data.notes.map(n => <p className="preview" key={n}>• {n}</p>)}
            </>}
          <Nav />
        </section>}

        {step === 1 && <section className="panel-step on">
          <h2>Meta models</h2>
          <p className="p-small">Using two independent models provides the strongest signal. API keys are stored as encrypted GitHub repository secrets. Keys saved in <Link to="/app/settings/keys">Settings → Model keys</Link> are filled in automatically; type a value here only to use a different one for this repository.</p>
          <div className="checks">{MODELS.map(([id, text]) => (
            <label className="check" key={id}>
              <input type="checkbox" checked={models.includes(id)} onChange={e => setModels(m => e.target.checked ? [...m, id] : m.filter(x => x !== id))} />
              <div><b>{MODEL_NAMES[id]}</b><span>{text}</span></div>
            </label>
          ))}</div>
          {MODELS.filter(([id]) => models.includes(id)).map(([m]) => (
            <div key={m}>
              <h3 className="h-panel" style={{ fontSize: 16, marginTop: 28 }}>{MODEL_NAMES[m]}</h3>
              {KEYS[m].map(([id, label, type, def]) => (
                <div className="field" key={id}><label htmlFor={id}>{label}</label>
                  <input id={id} type={type} autoComplete="off" spellCheck={false}
                    placeholder={saved[id] ? `saved in your account (${saved[id].hint})` : type === "password" ? "leave blank if already set" : def}
                    value={keys[id] ?? (saved[id] ? "" : def)} onChange={e => setKeys(k => ({ ...k, [id]: e.target.value }))} /></div>
              ))}
            </div>
          ))}
          <Nav />
        </section>}

        {step === 2 && <section className="panel-step on">
          <h2>Risk level</h2>
          <p className="p-small">Keel merges automatically only below a threshold calibrated so that, on average, no more than α of bugs receive an incorrect merge.</p>
          <div className="alpha-big"><span className="num">{Math.round(alpha * 100)}%</span>
            <input type="range" min={0.02} max={0.3} step={0.01} value={alpha} onChange={e => setAlpha(+e.target.value)} aria-label="Risk level alpha" /></div>
          <p className="preview">{!results ? "" : preview == null
            ? "At this level the shared calibration cannot certify a threshold, so every fix would be sent for review."
            : <>With the shared calibration, Keel would merge approximately <b>{preview}%</b> of fixes automatically and send the remainder for review.</>}</p>
          <div className="field"><label>Guarantee</label><div className="checks">
            <label className="check"><input type="radio" name="method" checked={method === "crc"} onChange={() => setMethod("crc")} /><div><b>Per bug (conformal risk control)</b><span>On average, no more than α of bugs receive an incorrect merge. More fixes are merged.</span></div></label>
            <label className="check"><input type="radio" name="method" checked={method === "ltt"} onChange={() => setMethod("ltt")} /><div><b>Per merge (Learn-then-Test)</b><span>No more than α of merges are incorrect, with 90% confidence. A stricter policy.</span></div></label>
          </div></div>
          <div className="field"><label>When a fix is labelled AUTO-MERGE</label><div className="checks">
            <label className="check"><input type="radio" name="merge" checked={!autoMerge} onChange={() => setAutoMerge(false)} /><div><b>Label only</b><span>Keel opens the pull request with the label; a maintainer completes the merge.</span></div></label>
            <label className="check"><input type="radio" name="merge" checked={autoMerge} onChange={() => setAutoMerge(true)} /><div><b>Merge automatically</b><span>Uses GitHub auto-merge, so required checks continue to apply.</span></div></label>
          </div></div>
          <Nav />
        </section>}

        {step === 3 && <section className="panel-step on">
          <h2>Activation</h2>
          <p className="p-small">Keel will store the keys as repository secrets and open a single pull request that adds <code>.github/workflows/keel.yml</code> and <code>.keel.toml</code>. Merge it to {current ? "apply the changes" : "go live"}.</p>
          <div className="found">
            <div><div className="k">Models</div><div className="v">{models.map(m => MODEL_NAMES[m]).join(", ") || "none"}</div></div>
            <div><div className="k">Policy</div><div className="v">α {Math.round(alpha * 100)}% · {method.toUpperCase()} · {autoMerge ? "auto-merge" : "label only"}</div></div>
            <div><div className="k">Secrets to store</div><div className="v">{new Set([...Object.keys(settings().secrets),
              ...models.flatMap(m => KEYS[m].map(k => k[0])).filter(id => saved[id])]).size}</div></div>
          </div>
          {shared.data && <p className={`callout${shared.data.available ? "" : " warn"}`} style={{ marginTop: 24 }}>{shared.data.available
            ? <>The pull request also adds the shared calibration ({shared.data.n} held-out bugs, {shared.data.source}) as <code>.keel/calibration.json</code>, which sets the merge threshold.</>
            : <>No shared calibration has been published yet. Keel will label fixes but will not merge any automatically until a calibration is added.</>}</p>}
          {!done && <div className="nav-steps">
            <button className="btn" onClick={() => go(2)}>Back</button>
            <button className="btn primary" disabled={busy} onClick={activate}>{busy ? "Opening pull request…" : <>Open {current ? "settings" : "setup"} pull request <span className="arrow">→</span></>}</button>
          </div>}
          {err && <p className="err">{err}</p>}
          {done && <div className="done-card" style={{ marginTop: 28 }}>
            <h3 className="h-panel" style={{ marginTop: 12 }}>Merge pull request #{done.number} to {current ? "apply the new settings" : "activate Keel"}</h3>
            <p className="p-small" style={{ marginTop: 6 }}>{done.stored} secret(s) stored on GitHub{done.fromAccount ? `, ${done.fromAccount} of them from your saved keys` : ""}.</p>
            {<p className="p-small" style={{ marginTop: 6 }}>Keel opens fix pull requests with the repository's Actions token. In the repository's Settings → Actions → General, tick <b>Allow GitHub Actions to create and approve pull requests</b>, if it is not already ticked.</p>}
            <div className="ctas start"><a className="btn primary" href={done.url} target="_blank" rel="noopener">Review on GitHub</a>
              <Link className="btn" to={repoPath(full)}>Go to overview</Link></div>
          </div>}
        </section>}
      </div>
    </div>
  );
}
