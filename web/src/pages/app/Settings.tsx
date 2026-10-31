import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Loading } from "../../components/app/Empty";
import { PageHead } from "../../components/PageHead";
import { useAsync } from "../../hooks/useAsync";
import { useTitle } from "../../hooks/useTitle";
import { api } from "../../lib/api";
import { DEMO } from "../../lib/env";
import { ago, MODEL_NAMES } from "../../lib/format";
import { KEYS } from "../../lib/modelKeys";
import { useSession } from "../../lib/session";
import type { Defaults, KeysApplied } from "../../lib/types";

function Tabs() {
  return (
    <nav className="settings-tabs" aria-label="Settings">
      <NavLink end to="/app/settings">Profile</NavLink><NavLink to="/app/settings/github">GitHub access</NavLink>
      <NavLink to="/app/settings/defaults">Defaults</NavLink><NavLink to="/app/settings/keys">Model keys</NavLink>
      <NavLink to="/app/settings/danger">Danger zone</NavLink>
    </nav>
  );
}
const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => {
  useTitle(`${title} · Settings · Keel`);
  return <><PageHead title="Settings" /><Tabs />{children}</>;
};

export function Profile() {
  const { data, error, reload } = useAsync(() => api.account(), []);
  const [msg, setMsg] = useState("");
  return (
    <Shell title="Profile">
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : (
        <>
          <div className="panel-box">
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {data.user.avatar_url && <img src={data.user.avatar_url} alt="" width={48} height={48} style={{ borderRadius: "50%" }} />}
              <div><h3 style={{ fontSize: 19 }}>{data.user.login}</h3><p className="p-small">Signed in with GitHub · member since {new Date(data.user.created_at).toLocaleDateString()}</p></div>
            </div>
            <p className="p-small" style={{ marginTop: 16 }}>Your name and avatar come from GitHub. Change them on <a href="https://github.com/settings/profile">github.com</a>.</p>
          </div>
          <div className="panel-box">
            <h3>Signed-in sessions</h3>
            <p className="p-small">Each browser you sign in from has its own session. Sessions last 30 days.</p>
            <div className="list" style={{ marginTop: 14 }}>{data.sessions.map(s => (
              <div className="list-row" key={s.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="t">Session {s.id}{s.current ? " · this browser" : ""}<small>started {ago(s.created_at)} · expires {new Date(s.expires_at).toLocaleDateString()}</small></span>
                {s.current && <span className="pill auto"><span className="dot" />current</span>}
              </div>))}</div>
            {data.sessions.length > 1 && <div className="row-actions"><button className="btn" onClick={async () => { const n = await api.revokeOtherSessions(); setMsg(`Signed out ${n} other session(s).`); reload(); }}>Sign out other sessions</button>{msg && <span className="ok-text">{msg}</span>}</div>}
          </div>
        </>
      )}
    </Shell>
  );
}

export function GitHubAccess() {
  const { me } = useSession();
  const { data, error } = useAsync(() => api.repos(), []);
  return (
    <Shell title="GitHub access">
      <div className="panel-box">
        <h3>Keel GitHub App installations</h3>
        <p className="p-small">Keel can only see repositories where the app is installed. Add or remove repositories on GitHub; Keel picks up the change on your next visit.</p>
        {error ? <p className="err">{error}</p> : !data ? <Loading /> : !data.installations.length ? <p className="p-small" style={{ marginTop: 14 }}>No installations yet.</p> : (
          <div className="list" style={{ marginTop: 14 }}>{data.installations.map(i => (
            <div className="list-row" key={i.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <span className="t">{i.account}<small>{i.type} · {i.repositorySelection === "all" ? "all repositories" : `${data.repos.filter(r => r.installation === i.account).length} selected repositories`}</small></span>
              <a className="btn" href={i.manageUrl} target="_blank" rel="noopener">Configure on GitHub</a>
            </div>))}</div>
        )}
        <div className="row-actions"><a className="btn primary" href={me?.installUrl} target="_blank" rel="noopener">Install on another account</a></div>
      </div>
      <div className="panel-box">
        <h3>Your GitHub authorization</h3>
        <p className="p-small">Keel acts with your permissions while you are signed in. Authorisation can be revoked at any time in <a href="https://github.com/settings/apps/authorizations">GitHub → Settings → Applications</a>; that signs you out of Keel everywhere.</p>
      </div>
    </Shell>
  );
}

export function DefaultsPage() {
  const { data, error } = useAsync(() => api.defaults(), []);
  const [d, setD] = useState<Defaults | null>(null), [saved, setSaved] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setD(data); }, [data]);
  const save = async () => { if (!d) return; setBusy(true); setSaved("");
    try { await api.saveDefaults(d); setSaved("Saved. New repositories start with these settings."); } catch (e) { setSaved((e as Error).message); }
    setBusy(false); };
  return (
    <Shell title="Defaults">
      {error ? <p className="err">{error}</p> : !d ? <Loading /> : (
        <div className="panel-box" style={{ maxWidth: 720 }}>
          <h3>Defaults for new repositories</h3>
          <p className="p-small">These values are used as the starting point for new repositories. Each repository can be changed individually on its Settings tab.</p>
          <div className="field"><label>Risk level α</label>
            <div className="alpha-big"><span className="num" style={{ fontSize: 40 }}>{Math.round(d.alpha * 100)}%</span>
              <input type="range" min={0.02} max={0.3} step={0.01} value={d.alpha} onChange={e => setD({ ...d, alpha: +e.target.value })} aria-label="Default risk level" /></div></div>
          <div className="field"><label htmlFor="method">Guarantee</label>
            <select id="method" value={d.method} onChange={e => setD({ ...d, method: e.target.value as Defaults["method"] })}>
              <option value="crc">Per bug (conformal risk control)</option><option value="ltt">Per merge (Learn-then-Test)</option></select></div>
          <div className="field"><label>Models</label><div className="checks">
            {Object.keys(MODEL_NAMES).map(m => (
              <label className="check" key={m}><input type="checkbox" checked={d.models.includes(m)} onChange={e => setD({ ...d, models: e.target.checked ? [...d.models, m] : d.models.filter(x => x !== m) })} /><div><b>{MODEL_NAMES[m]}</b></div></label>))}
          </div></div>
          <div className="field"><label className="check"><input type="checkbox" checked={d.autoMerge} onChange={e => setD({ ...d, autoMerge: e.target.checked })} /><div><b>Merge AUTO-MERGE fixes automatically</b><span>When disabled, AUTO-MERGE is a label only and a maintainer completes the merge.</span></div></label></div>
          <div className="row-actions"><button className="btn primary" disabled={busy || !d.models.length} onClick={save}>{busy ? "Saving…" : "Save defaults"}</button>{saved && <span className="ok-text">{saved}</span>}</div>
        </div>
      )}
    </Shell>
  );
}

export function ModelKeysPage() {
  const { data, error, reload } = useAsync(() => api.savedKeys(), []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(""), [applied, setApplied] = useState<KeysApplied | null>(null);
  const saved = Object.fromEntries((data || []).map(k => [k.name, k]));
  const changed = Object.fromEntries(Object.entries(vals).filter(([k, v]) => v.trim() !== (saved[k] && !k.endsWith("_API_KEY") ? saved[k].hint : "") && v.trim()));
  const save = async (keys: Record<string, string>, done: string) => { setBusy("save"); setMsg("");
    try { await api.saveKeys(keys); setVals({}); setMsg(done); reload(); } catch (e) { setMsg((e as Error).message); }
    setBusy(""); };
  const apply = async () => { setBusy("apply"); setApplied(null);
    try { setApplied(await api.applyKeys()); } catch (e) { setMsg((e as Error).message); }
    setBusy(""); };
  return (
    <Shell title="Model keys">
      {error ? <p className="err">{error}</p> : !data ? <Loading /> : (
        <>
          <div className="panel-box" style={{ maxWidth: 720 }}>
            <h3>Model keys</h3>
            <p className="p-small">Save each model's endpoint and API key once. Setting up a repository then copies them into its GitHub Actions secrets, so you do not paste them again. Keys are stored encrypted, are never shown again after saving (only their last 4 characters), and a value typed during a repository's setup still takes priority.</p>
            {Object.entries(KEYS).map(([m, fields]) => (
              <div key={m}>
                <h3 className="h-panel" style={{ fontSize: 16, marginTop: 24 }}>{MODEL_NAMES[m]}</h3>
                {fields.map(([id, label, type, def]) => {
                  const s = saved[id];
                  return (
                    <div className="field" key={id}><label htmlFor={`k-${id}`}>{label}{s && <span className="muted"> · saved {ago(s.updatedAt)}</span>}</label>
                      <input id={`k-${id}`} type={type} autoComplete="off" spellCheck={false}
                        placeholder={s ? (type === "password" ? `saved (${s.hint}); type a new key to replace it` : s.hint) : def || (type === "password" ? "not saved" : "")}
                        value={vals[id] ?? (s && type === "text" ? s.hint : "")} onChange={e => setVals(v => ({ ...v, [id]: e.target.value }))} />
                      {s && <button className="btn" style={{ marginTop: 6, padding: "4px 12px", fontSize: 13 }} disabled={!!busy} onClick={() => save({ [id]: "" }, `Removed ${label.toLowerCase()} for ${MODEL_NAMES[m]}.`)}>Remove</button>}
                    </div>);
                })}
              </div>
            ))}
            <div className="row-actions"><button className="btn primary" disabled={!!busy || !Object.keys(changed).length} onClick={() => save(changed, "Saved. New setups will use these keys.")}>{busy === "save" ? "Saving…" : "Save keys"}</button>{msg && <span className="ok-text">{msg}</span>}</div>
          </div>
          <div className="panel-box" style={{ maxWidth: 720 }}>
            <h3>Update repositories</h3>
            <p className="p-small">After changing a key, copy the saved keys into every repository you manage that is already set up. Only each repository's own models are updated; nothing else changes and no pull request is opened.</p>
            <div className="row-actions"><button className="btn" disabled={!!busy || !data.length} onClick={apply}>{busy === "apply" ? "Updating…" : "Update all repositories"}</button></div>
            {applied && <div className="list" style={{ marginTop: 14 }}>
              {!applied.updated.length && !applied.failed.length && <p className="p-small">No set-up repository uses these models yet.</p>}
              {applied.updated.map(u => <div className="list-row" key={u.repo} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="t">{u.repo}<small>{u.secrets.length} secret(s) updated</small></span><span className="pill auto"><span className="dot" />updated</span></div>)}
              {applied.failed.map(f => <div className="list-row" key={f.repo} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span className="t">{f.repo}<small>{f.error}</small></span><span className="pill review"><span className="dot" />failed</span></div>)}
            </div>}
          </div>
        </>
      )}
    </Shell>
  );
}

export function Danger() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const del = async () => { setBusy(true); setErr("");
    try { await api.deleteAccount(confirm); navigate("/"); await refresh(); } catch (e) { setErr((e as Error).message); setBusy(false); } };
  return (
    <Shell title="Danger zone">
      <div className="panel-box">
        <h3>Disconnect a repository</h3>
        <p className="p-small">Open the repository's Settings tab and use “Disconnect” at the bottom. That removes its runs and activity from Keel.</p>
      </div>
      <div className="panel-box danger">
        <h3>Delete your Keel account</h3>
        <p className="p-small">Deletes your sessions, defaults, saved model keys and repository access from Keel. Runs stay with their repositories for other maintainers. Your GitHub account, repositories and secrets are not touched; uninstall the GitHub App separately if you want Keel gone completely.</p>
        <div className="field" style={{ maxWidth: 360 }}><label htmlFor="confirm">Type <b>{me?.user?.login}</b> to confirm</label>
          <input id="confirm" type="text" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" /></div>
        <div className="row-actions"><button className="btn danger-btn" disabled={busy || confirm !== me?.user?.login} onClick={del}>{busy ? "Deleting…" : "Delete account"}</button>
          {DEMO && <span className="muted" style={{ fontSize: 13 }}>In the demo this just resets the sample data.</span>}</div>
        {err && <p className="err">{err}</p>}
      </div>
    </Shell>
  );
}
