import { DEMO } from "./env";
import {
  demoAccount, demoActivity, demoCalibration, demoDetection, demoFeedback, demoInstallations, demoMe, demoOverview, demoRepo,
  demoRepos, demoRun, demoRuns, demoState, demoUsage, logDemo, saveDemo,
} from "./demo";
import type {
  Account, ActivityEvent, CalibrationRow, SharedCalibrationInfo, Defaults, Detection, Installation, Me, Overview, RepoPayload, RepoSummary,
  KeysApplied, RunDetail, RunFilter, RunRow, SavedKey, SetupSettings, Usage,
} from "./types";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const demo = async <T,>(v: () => T, ms = 250): Promise<T> => { await sleep(ms); return v(); };

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { credentials: "same-origin", ...init,
    headers: { "Content-Type": "application/json", "x-keel": "1", ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error || `Request failed (${r.status})`);
  return data as T;
}
const repoPath = (full: string) => `/api/repos/${full.split("/").map(encodeURIComponent).join("/")}`;
const qs = (o: object) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); }); const s = p.toString(); return s ? `?${s}` : ""; };
const post = (body: unknown = {}) => ({ method: "POST", body: JSON.stringify(body) });
const KEY_PREFIX: Record<string, string> = { "muse-spark": "KEEL_MUSE_SPARK_", "muse-spark-open": "KEEL_SPARK_OPEN_", "muse-glimmer": "KEEL_GLIMMER_" };

// One interface, two implementations: the real API, and sample data for the demo build.
export const api = {
  async me(): Promise<Me> {
    if (DEMO) return demoMe();
    try { return await http<Me>("/api/me"); } catch { return { user: null, configured: false, installUrl: "#" }; }
  },
  async signOut(): Promise<void> {
    if (DEMO) { saveDemo({ ...demoState(), signedIn: false }); return; }
    await http("/auth/logout", post()).catch(() => undefined);
  },
  demoSignIn() { saveDemo({ ...demoState(), signedIn: true }); },

  // repositories
  async repos(): Promise<{ repos: RepoSummary[]; installations: Installation[] }> {
    if (DEMO) return demo(() => ({ repos: demoRepos(), installations: demoInstallations }), 300);
    return http("/api/repos");
  },
  repo: (full: string): Promise<RepoPayload> => (DEMO ? demo(() => demoRepo(full)) : http(repoPath(full))),
  async detect(full: string): Promise<Detection> {
    if (DEMO) return demo(() => demoDetection, 500);
    return (await http<{ detection: Detection }>(`${repoPath(full)}/detect`)).detection;
  },
  async setup(full: string, s: SetupSettings): Promise<{ pr: { number: number; url: string }; secretsStored: string[]; fromAccount: string[] }> {
    if (DEMO) {
      await sleep(700);
      const st = demoState();
      if (st.statuses[full] === "new") st.statuses[full] = "setup_pr_open";
      st.settings[full] = { alpha: s.alpha, method: s.method, autoMerge: s.autoMerge, models: s.models, ciWorkflow: s.ciWorkflow };
      saveDemo(st); logDemo("setup_pr", full, { pr: 2, secrets: Object.keys(s.secrets) });
      const fromAccount = st.keys.map(k => k.name).filter(n => !(n in s.secrets) && s.models.some(m => n.startsWith(KEY_PREFIX[m])));
      return { pr: { number: 2, url: "https://github.com/feedofmri/keel/pulls" }, secretsStored: [...Object.keys(s.secrets), ...fromAccount], fromAccount };
    }
    return http(`${repoPath(full)}/setup`, post(s));
  },
  async action(full: string, action: "fix" | "pause" | "resume" | "disconnect"): Promise<void> {
    if (DEMO) {
      await sleep(400);
      const st = demoState();
      if (action === "pause" || action === "resume") st.statuses[full] = action === "pause" ? "paused" : "active";
      if (action === "disconnect") st.disconnected = [...st.disconnected, full];
      saveDemo(st); logDemo(action === "fix" ? "fix_now" : action, action === "disconnect" ? null : full, action === "disconnect" ? { repo: full } : null);
      return;
    }
    await http(`${repoPath(full)}/${action}`, post());
  },

  // runs and insights
  overview: (): Promise<Overview> => (DEMO ? demo(demoOverview) : http("/api/overview")),
  runs: (f: RunFilter = {}): Promise<{ runs: RunRow[]; next: number | null }> => (DEMO ? demo(() => demoRuns(f)) : http(`/api/runs${qs(f)}`)),
  async run(id: number): Promise<RunDetail> {
    if (DEMO) { const r = await demo(() => demoRun(id)); if (!r) throw new ApiError(404, "run not found"); return r; }
    return (await http<{ run: RunDetail }>(`/api/runs/${id}`)).run;
  },
  async feedback(id: number, wrong: boolean): Promise<void> {
    if (DEMO) { await sleep(300); demoFeedback(id, wrong); return; }
    await http(`/api/runs/${id}/feedback`, post({ wrong }));
  },
  usage: (days: number): Promise<Usage> => (DEMO ? demo(() => demoUsage(days)) : http(`/api/usage?days=${days}`)),
  // In the demo there is no published calibration yet, as on a fresh deployment.
  sharedCalibration: (): Promise<SharedCalibrationInfo> => (DEMO ? demo(() => ({ available: false })) : http("/api/calibration/shared")),
  async calibration(): Promise<CalibrationRow[]> {
    if (DEMO) return demo(demoCalibration);
    return (await http<{ repos: CalibrationRow[] }>("/api/calibration")).repos;
  },
  async activity(repo?: string): Promise<ActivityEvent[]> {
    if (DEMO) return demo(() => demoActivity(repo));
    return (await http<{ events: ActivityEvent[] }>(`/api/activity${qs({ repo })}`)).events;
  },

  // account
  async defaults(): Promise<Defaults> {
    if (DEMO) return demo(() => demoState().defaults);
    return (await http<{ defaults: Defaults }>("/api/settings")).defaults;
  },
  async saveDefaults(d: Defaults): Promise<void> {
    if (DEMO) { await sleep(300); saveDemo({ ...demoState(), defaults: d }); return; }
    await http("/api/settings", { method: "PUT", body: JSON.stringify({ defaults: d }) });
  },
  async savedKeys(): Promise<SavedKey[]> {
    if (DEMO) return demo(() => demoState().keys);
    return (await http<{ keys: SavedKey[] }>("/api/settings/keys")).keys;
  },
  // An empty value removes that key.
  async saveKeys(keys: Record<string, string>): Promise<void> {
    if (DEMO) {
      await sleep(300);
      const st = demoState(), now = new Date().toISOString();
      const kept = st.keys.filter(k => !(k.name in keys));
      const added = Object.entries(keys).filter(([, v]) => v.trim())
        .map(([name, v]) => ({ name, hint: name.endsWith("_API_KEY") ? `••••${v.trim().slice(-4)}` : v.trim(), updatedAt: now }));
      saveDemo({ ...st, keys: [...kept, ...added] }); return;
    }
    await http("/api/settings/keys", { method: "PUT", body: JSON.stringify({ keys }) });
  },
  async applyKeys(): Promise<KeysApplied> {
    if (DEMO) {
      await sleep(600);
      const st = demoState(), names = st.keys.map(k => k.name);
      return { updated: demoRepos().filter(r => r.status !== "new" && r.canManage).map(r => ({ repo: r.full_name, secrets: names })), failed: [] };
    }
    return http("/api/settings/keys/apply", post());
  },
  account: (): Promise<Account> => (DEMO ? demo(demoAccount) : http("/api/account")),
  async revokeOtherSessions(): Promise<number> {
    if (DEMO) return demo(() => 1);
    return (await http<{ revoked: number }>("/api/account/sessions/revoke-others", post())).revoked;
  },
  async deleteAccount(confirm: string): Promise<void> {
    if (DEMO) { await sleep(400); try { sessionStorage.removeItem("keel-demo-state"); } catch { /* ignore */ } return; }
    await http("/api/account", { method: "DELETE", body: JSON.stringify({ confirm }) });
  },
};
