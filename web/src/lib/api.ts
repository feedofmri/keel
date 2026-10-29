import { DEMO } from "./env";
import { demoDetection, demoMe, demoRepo, demoRepos, demoState, saveDemo } from "./demo";
import type { Detection, Me, RepoPayload, RepoSummary, SetupSettings } from "./types";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { credentials: "same-origin", ...init,
    headers: { "Content-Type": "application/json", "x-keel": "1", ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as any).error || `Request failed (${r.status})`);
  return data as T;
}
const repoPath = (full: string) => `/api/repos/${full.split("/").map(encodeURIComponent).join("/")}`;

// One interface, two implementations: the real API, and sample data for the demo build.
export const api = {
  async me(): Promise<Me> {
    if (DEMO) return demoMe();
    try { return await http<Me>("/api/me"); } catch { return { user: null, configured: false, installUrl: "#" }; }
  },
  async signOut(): Promise<void> {
    if (DEMO) { saveDemo({ ...demoState(), signedIn: false }); return; }
    await http("/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
  },
  demoSignIn() { saveDemo({ ...demoState(), signedIn: true }); },
  async repos(): Promise<RepoSummary[]> {
    if (DEMO) { await sleep(300); return demoRepos(); }
    return (await http<{ repos: RepoSummary[] }>("/api/repos")).repos;
  },
  async repo(full: string): Promise<RepoPayload> {
    if (DEMO) { await sleep(250); return demoRepo(full); }
    return http<RepoPayload>(repoPath(full));
  },
  async detect(full: string): Promise<Detection> {
    if (DEMO) { await sleep(500); return demoDetection; }
    return (await http<{ detection: Detection }>(`${repoPath(full)}/detect`)).detection;
  },
  async setup(full: string, s: SetupSettings): Promise<{ pr: { number: number; url: string }; secretsStored: string[] }> {
    if (DEMO) {
      await sleep(700);
      const st = demoState();
      if (st.statuses[full] === "new") st.statuses[full] = "setup_pr_open";
      st.settings[full] = { alpha: s.alpha, method: s.method, autoMerge: s.autoMerge, models: s.models, ciWorkflow: s.ciWorkflow };
      saveDemo(st);
      return { pr: { number: 2, url: "https://github.com/feedofmri/keel/pulls" }, secretsStored: Object.keys(s.secrets) };
    }
    return http(`${repoPath(full)}/setup`, { method: "POST", body: JSON.stringify(s) });
  },
  async action(full: string, action: "fix" | "pause" | "resume"): Promise<void> {
    if (DEMO) {
      await sleep(400);
      if (action !== "fix") { const st = demoState(); st.statuses[full] = action === "pause" ? "paused" : "active"; saveDemo(st); }
      return;
    }
    await http(`${repoPath(full)}/${action}`, { method: "POST", body: "{}" });
  },
};
