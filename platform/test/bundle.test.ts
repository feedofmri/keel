import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const sodium: typeof import("libsodium-wrappers") = createRequire(import.meta.url)("libsodium-wrappers");

describe("deploy bundle", () => {
  it("seals secrets without libsodium, which needs WebAssembly the host may not start", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "keel-bundle-")), "secrets.mjs");
    const r = await build({
      stdin: { contents: 'export { sealForGitHub } from "./src/setup/secrets.ts";', resolveDir: root, loader: "ts" },
      outfile: out, bundle: true, platform: "node", format: "esm", write: true, metafile: true, logLevel: "silent",
    });
    expect(Object.keys(r.metafile!.inputs).some(p => p.includes("libsodium"))).toBe(false);
    const { sealForGitHub } = await import(pathToFileURL(out).href);
    // libsodium (a dev dependency here) is the reference GitHub uses: the sealed box must open with it
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sealed = await sealForGitHub("hello-secret ✓", sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL));
    const opened = sodium.crypto_box_seal_open(sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL), kp.publicKey, kp.privateKey);
    expect(sodium.to_string(opened)).toBe("hello-secret ✓");
  }, 60_000);
});
