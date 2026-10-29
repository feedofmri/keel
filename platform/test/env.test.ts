import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizePem } from "../src/env.js";

describe("GitHub App private key from cPanel's one-line field", () => {
  const pem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs1", format: "pem" }) as string;
  const forms = {
    "as downloaded": pem,
    "\\n-escaped": pem.trim().split("\n").join("\\n"),
    "line breaks turned into spaces": pem.trim().split("\n").join(" "),
    "line breaks dropped": pem.trim().split("\n").join(""),
  };
  for (const [name, value] of Object.entries(forms))
    it(`accepts the key ${name}`, () => {
      const key = createPrivateKey(normalizePem(value));
      expect(key.asymmetricKeyType).toBe("rsa");
    });
  it("leaves an empty value empty", () => expect(normalizePem("")).toBe(""));
});
