// Run from cPanel cron, e.g. every 10 minutes:  cd ~/keel-app && node dist/jobs/maintenance.js
import { createDb } from "../db/index.js";
import { loadEnv } from "../env.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const s = await db.query("delete from sessions where expires_at < now()");
console.log(`removed ${s.rowCount} expired sessions`);
await db.end();
