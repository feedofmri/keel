import { buildApp } from "./app.js";
import { createDb } from "./db/index.js";
import { prune } from "./db/retention.js";
import { loadEnv, retentionOf } from "./env.js";
import { migrate } from "./migrate.js";

// Entry point for cPanel's "Setup Node.js App" (Phusion Passenger). Passenger supplies PORT.
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
await migrate(db, m => console.log(`[migrate] ${m}`));
const app = await buildApp(db, env);
await app.listen({ port: env.PORT, host: "0.0.0.0" });

// Prune old data at start-up and once a day, so no cron job is needed.
const tidy = () => prune(db, retentionOf(env)).then(c => app.log.info({ pruned: c }, "retention")).catch(err => app.log.error({ err }, "retention failed"));
tidy();
setInterval(tidy, 24 * 3600e3).unref();
