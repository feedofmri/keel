// Optional: prune from a cPanel cron job instead of waiting for the server's daily run.
//   cd ~/keel-app && node dist/jobs/maintenance.js
import { createDb } from "../db/index.js";
import { prune } from "../db/retention.js";
import { loadEnv, retentionOf } from "../env.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
console.log("pruned", await prune(db, retentionOf(env)));
await db.end();
