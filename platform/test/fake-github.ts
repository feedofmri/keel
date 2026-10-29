import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A small in-process stand-in for github.com and api.github.com, covering exactly the calls the
 * platform makes. It records what Keel wrote (secrets, files, pull requests, dispatches) so tests
 * can assert on it.
 */
export interface FakeRepo { id: number; full_name: string; default_branch: string; private: boolean; language: string; perm: "admin" | "maintain" | "write" | "read" }
export interface FakeState {
  user: { id: number; login: string; avatar_url: string };
  installation: { id: number; account: string; type: string };
  repos: FakeRepo[];
  tree: string[];
  files: Record<string, string>;                // repository files readable through the contents API
  publicKey: { key: string; key_id: string };   // repository public key for secrets
  secrets: Record<string, { encrypted_value: string; key_id: string }>;
  written: Record<string, string>;              // files written on the keel/setup branch (decoded)
  refs: string[];
  pulls: { number: number; head: string; base: string; title: string; body: string; html_url: string }[];
  dispatches: string[];
  workflowState: string[];
  workflowOnMain: boolean;
  expiredTokens: Set<string>;
  tokenCounter: number;
}

const json = (res: any, status: number, body?: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req: IncomingMessage) => new Promise<any>(ok => {
  let b = ""; req.on("data", c => (b += c)); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { ok({}); } });
});

export async function startFakeGitHub(state: FakeState): Promise<{ url: string; close: () => Promise<void>; server: Server }> {
  const server = createServer(async (req, res) => {
    const u = new URL(req.url || "/", "http://x"), path = decodeURIComponent(u.pathname), method = req.method || "GET";  // GitHub decodes %2F in refs and paths
    const auth = String(req.headers.authorization || "").replace(/^(Bearer|token) /, "");
    const body = method === "GET" ? {} : await readBody(req);
    const repo = (owner: string, name: string) => state.repos.find(r => r.full_name === `${owner}/${name}`);
    let m: RegExpMatchArray | null;

    // web: OAuth (the authorize page signs the user straight back in, as if they clicked "Authorize")
    if (path === "/login/oauth/authorize") {
      const back = new URL(u.searchParams.get("redirect_uri")!); back.searchParams.set("code", "ok"); back.searchParams.set("state", u.searchParams.get("state") || "");
      res.writeHead(302, { Location: back.toString() }); return res.end();
    }
    if (path === "/login/oauth/access_token" && method === "POST") {
      if (body.code === "bad") return json(res, 200, { error: "bad_verification_code" });
      state.tokenCounter += 1;
      return json(res, 200, { access_token: `ghu_user_${state.tokenCounter}`, refresh_token: "ghr_refresh", expires_in: 28800 });
    }
    // app: installation access tokens (Octokit signs a JWT with the app's private key)
    if ((m = path.match(/^\/app\/installations\/(\d+)\/access_tokens$/)) && method === "POST")
      return json(res, 201, { token: "ghs_installation", expires_at: new Date(Date.now() + 3600e3).toISOString(), permissions: {}, repository_selection: "selected" });

    // user API
    if (auth.startsWith("ghu_") && state.expiredTokens.has(auth)) return json(res, 401, { message: "Bad credentials" });
    if (path === "/user") return json(res, 200, state.user);
    if (path === "/user/installations")
      return json(res, 200, { total_count: 1, installations: [{ id: state.installation.id, account: { login: state.installation.account, type: state.installation.type },
        repository_selection: "selected", html_url: `https://github.com/settings/installations/${state.installation.id}` }] });
    if ((m = path.match(/^\/user\/installations\/(\d+)\/repositories$/)))
      return json(res, 200, { total_count: state.repos.length, repositories: state.repos.map(r => ({ id: r.id, full_name: r.full_name, private: r.private, language: r.language,
        default_branch: r.default_branch, permissions: { admin: r.perm === "admin", maintain: r.perm === "maintain" || r.perm === "admin", push: r.perm !== "read", pull: true } })) });

    // repository API (user or installation token)
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)$/))) {
      const r = repo(m[1], m[2]); if (!r) return json(res, 404, { message: "Not Found" });
      return json(res, 200, { id: r.id, full_name: r.full_name, default_branch: r.default_branch,
        permissions: { admin: r.perm === "admin", maintain: r.perm === "maintain" || r.perm === "admin", push: r.perm !== "read", pull: true } });
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/trees\/(.+)$/)))
      return json(res, 200, { tree: state.tree.map(p => ({ path: p, type: "blob" })) });
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/))) {
      const file = decodeURIComponent(m[3]);
      if (method === "GET") {
        if (u.searchParams.get("ref") === "keel/setup") return state.written[file] !== undefined ? json(res, 200, { sha: "s1" }) : json(res, 404, { message: "Not Found" });
        const c = state.files[file]; return c === undefined ? json(res, 404, { message: "Not Found" }) : json(res, 200, { type: "file", sha: "s0", content: Buffer.from(c).toString("base64") });
      }
      if (method === "PUT") { state.written[file] = Buffer.from(body.content, "base64").toString("utf8"); return json(res, 201, { content: { path: file } }); }
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/actions\/secrets\/public-key$/))) return json(res, 200, state.publicKey);
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/actions\/secrets\/([A-Z_]+)$/)) && method === "PUT") {
      state.secrets[m[3]] = { encrypted_value: body.encrypted_value, key_id: body.key_id }; return json(res, 201);
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/ref\/heads\/(.+)$/))) return json(res, 200, { object: { sha: "base123" } });
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/refs$/)) && method === "POST") {
      if (state.refs.includes(body.ref)) return json(res, 422, { message: "Reference already exists" });
      state.refs.push(body.ref); return json(res, 201, { ref: body.ref });
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/git\/refs\/(.+)$/)) && method === "PATCH") return json(res, 200, { ref: m[3] });
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/pulls$/))) {
      if (method === "GET") return json(res, 200, state.pulls.filter(p => `${m![1]}:${p.head}` === u.searchParams.get("head")).map(p => ({ number: p.number, html_url: p.html_url })));
      const number = 7 + state.pulls.length, html_url = `https://github.com/${m[1]}/${m[2]}/pull/${number}`;
      state.pulls.push({ number, head: body.head, base: body.base, title: body.title, body: body.body, html_url });
      return json(res, 201, { number, html_url });
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/actions\/workflows\/([^/]+)\/dispatches$/)) && method === "POST") {
      if (!state.workflowOnMain) return json(res, 404, { message: "Not Found" });
      state.dispatches.push(`${m[3]}@${body.ref}`); res.writeHead(204); return res.end();
    }
    if ((m = path.match(/^\/repos\/([^/]+)\/([^/]+)\/actions\/workflows\/([^/]+)\/(enable|disable)$/)) && method === "PUT") {
      if (!state.workflowOnMain) return json(res, 404, { message: "Not Found" });
      state.workflowState.push(m[4]); res.writeHead(204); return res.end();
    }
    if (process.env.FAKE_GH_DEBUG) console.log("fake GitHub: no route", method, req.url);
    json(res, 404, { message: `fake GitHub has no route for ${method} ${path}` });
  });
  await new Promise<void>(ok => server.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, server, close: () => new Promise(ok => server.close(() => ok())) };
}
