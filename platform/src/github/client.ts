import { App, Octokit } from "octokit";
import type { Env } from "../env.js";

let API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Call the GitHub REST API as the signed-in user. */
export async function userApi<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(API + path, { ...init, headers: {
    Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token}`, "User-Agent": "keel-platform", ...(init.headers || {}) } });
  if (!r.ok) throw new GitHubError(r.status, `GitHub ${init.method || "GET"} ${path}: ${r.status} ${await r.text()}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

let app: App | null = null;

/** Point the clients at GitHub (or at a fake GitHub in tests). Called once when the server is built. */
export function configureGitHub(env: Env) {
  API = env.GITHUB_API_URL.replace(/\/$/, "");
  app = null;
}

/** The Keel GitHub App, used to act on repositories it is installed on. */
export function githubApp(env: Env): App {
  if (!app) app = new App({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_PRIVATE_KEY,
                            oauth: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
                            Octokit: Octokit.defaults({ baseUrl: API }) });
  return app;
}

export async function installationOctokit(env: Env, installationId: number) {
  return githubApp(env).getInstallationOctokit(installationId);
}

export type RepoPermission = "admin" | "maintain" | "write" | "read" | "none";

/** The signed-in user's live permission on a repository (never trust a client-supplied claim). */
export async function userPermission(token: string, fullName: string): Promise<RepoPermission> {
  try {
    const repo = await userApi<{ permissions?: Record<string, boolean> }>(token, `/repos/${fullName}`);
    const p = repo.permissions || {};
    return p.admin ? "admin" : p.maintain ? "maintain" : p.push ? "write" : p.pull ? "read" : "none";
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 403)) return "none";
    throw e;
  }
}

export const canManage = (p: RepoPermission) => p === "admin" || p === "maintain";
