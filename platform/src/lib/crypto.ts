import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// AES-256-GCM for data at rest (GitHub user tokens). Key derived from SESSION_SECRET.
const keyFrom = (secret: string) => createHash("sha256").update("keel:at-rest:" + secret).digest();

export function encrypt(plain: string, secret: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decrypt(blob: Buffer, secret: string): string {
  const iv = blob.subarray(0, 12), tag = blob.subarray(12, 28), body = blob.subarray(28);
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

export const randomId = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
