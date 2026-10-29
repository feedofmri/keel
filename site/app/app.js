// Keel app client. Talks to the Keel API on the same origin. On GitHub Pages (or with ?demo) there is
// no API, so it runs in demo mode with sample data and clearly says so.
(() => {
  const params = new URLSearchParams(location.search);
  const DEMO = location.hostname.endsWith("github.io") || params.has("demo");
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const demo = {
    me: { user: { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4" }, configured: true,
          installUrl: "https://github.com/apps/keel-ai/installations/new" },
    repos: { repos: [
      { full_name: "feedofmri/keel-demo", private: false, language: "Python", status: "active", alpha: 0.1, canManage: true },
      { full_name: "feedofmri/shop-api", private: true, language: "Python", status: "setup_pr_open", alpha: 0.1, canManage: true },
      { full_name: "feedofmri/data-tools", private: false, language: "Python", status: "new", alpha: 0.1, canManage: true },
    ] },
    detect: { detection: { language: "python", installCommand: "pip install -e . pytest", ciWorkflow: "CI", workflows: ["CI", "Release"],
              testCommand: "{python} -m pytest -q", notes: [] },
              secretNames: ["KEEL_MUSE_SPARK_BASE_URL", "KEEL_MUSE_SPARK_API_KEY", "KEEL_MUSE_SPARK_MODEL", "KEEL_SPARK_OPEN_BASE_URL",
                            "KEEL_SPARK_OPEN_API_KEY", "KEEL_SPARK_OPEN_MODEL", "KEEL_GLIMMER_BASE_URL", "KEEL_GLIMMER_API_KEY", "KEEL_GLIMMER_MODEL"] },
    repo(full) {
      const now = Date.now(), h = 3600e3;
      const runs = [
        { id: 6, trigger: "workflow_run", commit_sha: "9f2c1ab", finished_at: new Date(now - 0.4 * h).toISOString(), n_candidates: 10, selected_score: 0.001, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 41, cost_usd: 0.031, report: { failing_tests: ["tests/test_pricing.py::test_ten_percent_discount"], reasons: ["passes 100% of the adversarial tests written by Muse Spark", "the other Meta model independently reached the same behaviour"] }, merged_at: new Date(now - 0.3 * h).toISOString() },
        { id: 5, trigger: "issue_comment", commit_sha: "51d0e7c", finished_at: new Date(now - 5 * h).toISOString(), n_candidates: 10, selected_score: 0.939, threshold: 0.375, decision: "NEEDS REVIEW", pr_number: 39, cost_usd: 0.044, report: { failing_tests: ["tests/test_shipping.py::test_order_at_threshold_ships_free"], reasons: ["fails 50% of the adversarial tests written by Muse Spark", "behaves differently from most other candidates"] } },
        { id: 4, trigger: "workflow_run", commit_sha: "c77a210", finished_at: new Date(now - 26 * h).toISOString(), n_candidates: 10, selected_score: 0.012, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 36, cost_usd: 0.029, report: { failing_tests: ["tests/test_cart.py::test_empty_cart"], reasons: ["the change is small and targeted"] }, merged_at: new Date(now - 25 * h).toISOString() },
        { id: 3, trigger: "workflow_run", commit_sha: "0be4d19", finished_at: new Date(now - 50 * h).toISOString(), n_candidates: 10, selected_score: 0.61, threshold: 0.375, decision: "NEEDS REVIEW", pr_number: 33, cost_usd: 0.052, report: { failing_tests: ["tests/test_tax.py::test_vat_rounding"], reasons: ["only 20% of other samples behave the same way"] } },
        { id: 2, trigger: "workflow_dispatch", commit_sha: "7aa91f3", finished_at: new Date(now - 74 * h).toISOString(), n_candidates: 10, selected_score: 0.004, threshold: 0.375, decision: "AUTO-MERGE", pr_number: 30, cost_usd: 0.027, report: { failing_tests: ["tests/test_pricing.py::test_line_total"], reasons: ["edits the code named in the failing traceback"] }, merged_at: new Date(now - 73 * h).toISOString() },
      ];
      const status = demo.repos.repos.find(r => r.full_name === full)?.status || "active";
      return { repo: { full_name: full, status, alpha: 0.1, method: "crc", autoMerge: false, models: ["muse-spark", "muse-spark-open"],
                       ciWorkflow: "CI", setupPr: 2, activatedAt: new Date(now - 80 * h).toISOString(), canManage: true },
               stats: { runs: runs.length, autoMerged: 3, wrong: 0, cost: runs.reduce((s, r) => s + r.cost_usd, 0) }, runs };
    },
  };

  async function api(path, opts = {}) {
    if (DEMO) {
      await sleep(250 + Math.random() * 250);
      if (path === "/api/me") { let signed = false; try { signed = sessionStorage.getItem("keel-demo-signed") === "1"; } catch (e) {}
        return signed ? demo.me : { ...demo.me, user: null }; }
      if (path === "/api/repos") return demo.repos;
      if (path.endsWith("/detect")) return demo.detect;
      if (path.endsWith("/setup")) return { pr: { number: 2, url: "https://github.com/feedofmri/keel/pulls" }, secretsStored: Object.keys(JSON.parse(opts.body || "{}").secrets || {}) };
      if (/\/(fix|pause|resume)$/.test(path)) return { ok: true };
      const m = path.match(/^\/api\/repos\/([^/]+\/[^/]+)$/); if (m) return demo.repo(decodeURIComponent(m[1]));
      throw new Error("not available in demo");
    }
    const r = await fetch(path, { credentials: "same-origin", ...opts,
      headers: { "Content-Type": "application/json", "x-keel": "1", ...(opts.headers || {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || `request failed (${r.status})`); e.status = r.status; throw e; }
    return data;
  }

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ago = iso => { if (!iso) return "–"; const s = (Date.now() - new Date(iso)) / 1000;
    return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
  const STATUS = { new: ["Not set up", "muted"], setup_pr_open: ["Setup PR open", "review"], active: ["Active", "auto"], paused: ["Paused", "muted"], error: ["Error", "review"] };
  const statusPill = s => { const [t, c] = STATUS[s] || [s, "muted"]; return `<span class="pill ${c}"><span class="dot"></span>${esc(t)}</span>`; };

  function shell(me) {
    const banner = DEMO ? `<div class="demo-banner">Demo mode with sample data. The live app runs at <a href="https://keel.boraqs.com/app/">keel.boraqs.com</a>.</div>` : "";
    document.getElementById("demo").innerHTML = banner;
    const u = me && me.user;
    document.getElementById("who").innerHTML = u
      ? `<img src="${esc(u.avatar_url)}" alt="" width="24" height="24"><span>${esc(u.login)}</span><button class="btn" id="signout" style="height:30px">Sign out</button>`
      : `<a class="btn primary" href="${signInHref()}" data-signin style="height:32px">Sign in with GitHub</a>`;
    const so = document.getElementById("signout");
    if (so) so.onclick = async () => {
      if (DEMO) { try { sessionStorage.removeItem("keel-demo-signed"); } catch (e) {} location.href = "./?demo"; return; }
      await api("/auth/logout", { method: "POST", body: "{}" }); location.href = "/"; };
    wireSignIn();
  }
  const signInHref = () => DEMO ? "./?demo" : "/auth/github/login";
  // In demo mode "signing in" just flips a flag for this tab.
  function wireSignIn() { if (DEMO) document.querySelectorAll("[data-signin]").forEach(a => a.onclick = e => {
    e.preventDefault(); try { sessionStorage.setItem("keel-demo-signed", "1"); } catch (x) {} location.href = "./?demo"; }); }

  window.KeelApp = { api, esc, ago, statusPill, shell, DEMO, params, signInHref, wireSignIn };
})();
