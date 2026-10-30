import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl, normalizePem } from "../src/env.js";

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

describe("DATABASE_URL as typed into cPanel", () => {
  const ok = (raw: string) => { const u = new URL(normalizeDatabaseUrl(raw)); return { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password), host: u.hostname, port: u.port, db: u.pathname.slice(1), q: u.search }; };
  it("leaves a clean URL as it is, apart from localhost", () =>
    expect(ok("postgres://boraqsco_keel_user:abc123@localhost:5432/boraqsco_keel?sslmode=disable"))
      .toEqual({ user: "boraqsco_keel_user", pass: "abc123", host: "127.0.0.1", port: "5432", db: "boraqsco_keel", q: "?sslmode=disable" }));
  it("encodes special characters in the password", () =>
    expect(ok("postgres://u:pa;ss@w/o#r?d:x@127.0.0.1:5432/db?sslmode=disable").pass).toBe("pa;ss@w/o#r?d:x"));
  it("keeps an already-encoded password", () => expect(ok("postgres://u:p%40ss@127.0.0.1/db").pass).toBe("p@ss"));
  it("drops surrounding quotes and spaces", () => expect(ok(` "postgres://u:p@127.0.0.1:5432/db" `).db).toBe("db"));
  it("explains a placeholder left in", () => expect(() => normalizeDatabaseUrl("postgres://u:p@localhost:5432/<db-name>")).toThrow(/placeholder/));
  it("explains a malformed value", () => expect(() => normalizeDatabaseUrl("boraqsco_keel")).toThrow(/must look like/));
  it("reports missing settings by name, not by value", async () => {
    const { loadEnv } = await import("../src/env.js");
    expect(() => loadEnv({} as any)).toThrow(/DATABASE_URL: not set[\s\S]*SESSION_SECRET: not set/);
  });
});
