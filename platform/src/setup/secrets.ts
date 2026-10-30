import { blake2b } from "blakejs";
import nacl from "tweetnacl";

/** Encrypt a value for a GitHub repository secret: a libsodium sealed box for the repo public key.
 *  Pure JavaScript (tweetnacl + blakejs) because libsodium needs WebAssembly, which fails to start
 *  on memory-limited shared hosting and took the whole server down with it. */
export async function sealForGitHub(value: string, publicKeyB64: string): Promise<string> {
  const key = new Uint8Array(Buffer.from(publicKeyB64, "base64"));
  if (key.length !== nacl.box.publicKeyLength) throw new Error("invalid repository public key");
  const eph = nacl.box.keyPair();
  // crypto_box_seal: nonce = BLAKE2b-192(ephemeral pk || recipient pk), output = ephemeral pk || box
  const nonce = blake2b(new Uint8Array([...eph.publicKey, ...key]), undefined, nacl.box.nonceLength);
  const box = nacl.box(new Uint8Array(Buffer.from(value, "utf8")), nonce, key, eph.secretKey);
  return Buffer.concat([eph.publicKey, box]).toString("base64");
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
