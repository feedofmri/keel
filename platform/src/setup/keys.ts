import { many, type Db } from "../db/index.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { ALL_SECRET_NAMES } from "./files.js";

// Model endpoints and keys saved once per account, so setting up another repository does not mean
// pasting them again. Stored encrypted; only ever sent to GitHub as sealed repository secrets.

export const isKeyName = (name: string) => ALL_SECRET_NAMES.includes(name);

/** What the Settings page may show: API keys only by their last 4 characters, URLs and model ids in full. */
export const hintFor = (name: string, value: string) => name.endsWith("_API_KEY") ? `••••${value.slice(-4)}` : value;

export async function savedKeys(db: Db, secret: string, userId: number): Promise<Record<string, string>> {
  const rows = await many<{ name: string; enc_value: Buffer }>(db, "select name, enc_value from user_model_keys where user_id = $1", [userId]);
  const out: Record<string, string> = {};
  for (const r of rows) {
    try { out[r.name] = decrypt(r.enc_value, secret); } catch { /* encrypted under an older SESSION_SECRET: treat as not saved */ }
  }
  return out;
}

/** Save or replace values; an empty value removes that key. */
export async function saveKeys(db: Db, secret: string, userId: number, values: Record<string, string>): Promise<void> {
  for (const [name, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) await db.query("delete from user_model_keys where user_id = $1 and name = $2", [userId, name]);
    else await db.query(`insert into user_model_keys (user_id, name, enc_value) values ($1, $2, $3)
                         on conflict (user_id, name) do update set enc_value = excluded.enc_value, updated_at = now()`,
                        [userId, name, encrypt(value, secret)]);
  }
}
