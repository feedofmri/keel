import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "./db/index.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "db", "migrations");

export async function migrate(db: Db, log: (m: string) => void = console.log): Promise<void> {
  await db.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map(r => r.name));
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const client = await db.connect();
    try {
      await client.query("begin");
      await client.query(readFileSync(join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      log(`applied ${file}`);
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
  const db = createDb(url);
  migrate(db).then(() => db.end()).catch(e => { console.error(e); process.exit(1); });
}
