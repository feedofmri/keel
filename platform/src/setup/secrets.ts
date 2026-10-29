import { createRequire } from "node:module";

// The package's ESM build is broken upstream; its CommonJS build works everywhere.
const sodium: typeof import("libsodium-wrappers") = createRequire(import.meta.url)("libsodium-wrappers");

/** Encrypt a value for a GitHub repository secret (libsodium sealed box with the repo public key). */
export async function sealForGitHub(value: string, publicKeyB64: string): Promise<string> {
  await sodium.ready;
  const key = sodium.from_base64(publicKeyB64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), key);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}

type Octo = { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: any }> };

export async function putRepoSecrets(octo: Octo, owner: string, repo: string, secrets: Record<string, string>): Promise<string[]> {
  const entries = Object.entries(secrets).filter(([, v]) => v && v.trim());
  if (!entries.length) return [];
  const { data: pk } = await octo.request("GET /repos/{owner}/{repo}/actions/secrets/public-key", { owner, repo });
  for (const [name, value] of entries) {
    await octo.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
      owner, repo, secret_name: name, encrypted_value: await sealForGitHub(value.trim(), pk.key), key_id: pk.key_id });
  }
  return entries.map(([n]) => n);
}
