import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/lib/crypto.js";
import { detect, workflowName } from "../src/setup/detect.js";
import { renderKeelToml, renderWorkflow, secretNamesFor } from "../src/setup/files.js";
import { sealForGitHub } from "../src/setup/secrets.js";

const sodium: typeof import("libsodium-wrappers") = createRequire(import.meta.url)("libsodium-wrappers");

describe("detect", () => {
  it("finds python, install command and the test workflow", () => {
    const d = detect(["pyproject.toml", "src/a.py", "tests/test_a.py", ".github/workflows/ci.yml", ".github/workflows/release.yml"], {
      ".github/workflows/ci.yml": "name: CI\non: push\njobs:\n  t:\n    steps:\n      - run: pytest -q\n",
      ".github/workflows/release.yml": "name: Release\non: push\n",
    });
    expect(d.language).toBe("python");
    expect(d.installCommand).toBe("pip install -e . pytest");
    expect(d.ciWorkflow).toBe("CI");
    expect(d.notes).toEqual([]);
  });
  it("explains what is missing", () => {
    const d = detect(["README.md"], {});
    expect(d.language).toBe("unknown");
    expect(d.ciWorkflow).toBeNull();
    expect(d.notes.length).toBeGreaterThan(1);
  });
  it("reads quoted workflow names", () => expect(workflowName('name: "Tests"\n', "x")).toBe("Tests"));
});

describe("setup files", () => {
  const s = { alpha: 0.1, method: "crc" as const, autoMerge: false, models: ["muse-spark", "muse-spark-open"], ciWorkflow: "CI",
              installCommand: "pip install -e . pytest", testCommand: "{python} -m pytest -q {tests} --junitxml={junit}" };
  it("workflow triggers on the CI workflow and passes only the needed secrets", () => {
    const y = renderWorkflow(s, "feedofmri/keel@v1", "https://keel.boraqs.com");
    expect(y).toContain('workflows: ["CI"]');
    expect(y).toContain("id-token: write");
    expect(y).toContain("KEEL_MUSE_SPARK_API_KEY: ${{ secrets.KEEL_MUSE_SPARK_API_KEY }}");
    expect(y).not.toContain("GLIMMER");
    expect(y).toContain("uses: feedofmri/keel@v1");
  });
  it("toml carries the policy", () => {
    const t = renderKeelToml(s);
    expect(t).toContain("alpha = 0.10");
    expect(t).toContain('method = "crc"');
    expect(t).toContain("enable_auto_merge = false");
  });
  it("secret names per model", () => expect(secretNamesFor(["muse-glimmer"])).toEqual(["KEEL_GLIMMER_BASE_URL", "KEEL_GLIMMER_API_KEY", "KEEL_GLIMMER_MODEL"]));
});

describe("crypto", () => {
  it("round-trips data at rest", () => expect(decrypt(encrypt("ghu_secret", "x".repeat(40)), "x".repeat(40))).toBe("ghu_secret"));
  it("rejects tampered data", () => {
    const b = encrypt("ghu_secret", "x".repeat(40)); b[b.length - 1] ^= 1;
    expect(() => decrypt(b, "x".repeat(40))).toThrow();
  });
  it("seals secrets the way GitHub expects", async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sealed = await sealForGitHub("key-123", sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL));
    const opened = sodium.crypto_box_seal_open(sodium.from_base64(sealed, sodium.base64_variants.ORIGINAL), kp.publicKey, kp.privateKey);
    expect(sodium.to_string(opened)).toBe("key-123");
  });
});
