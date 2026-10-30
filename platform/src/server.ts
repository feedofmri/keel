import { buildApp } from "./app.js";
import { createDb } from "./db/index.js";
import { prune } from "./db/retention.js";
import { loadEnv, loadEnvFile, retentionOf } from "./env.js";
import { migrate } from "./migrate.js";

// Entry point for cPanel's "Setup Node.js App" (Phusion Passenger). Passenger supplies PORT.
// Node's fetch (used for every GitHub call) runs on WebAssembly. Shared hosts cap virtual memory,
// and WebAssembly then cannot reserve its memory, so the first GitHub call kills the server.
try { new WebAssembly.Memory({ initial: 1 }); } catch {
  console.error("Keel cannot start: WebAssembly cannot allocate memory on this host. In cPanel → Setup Node.js App → " +
    "Environment variables, add NODE_OPTIONS = --disable-wasm-trap-handler, then Restart.");
  process.exit(1);
}
const envFile = loadEnvFile();
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
if (envFile) console.log(`[env] settings read from ${envFile}`);
await migrate(db, m => console.log(`[migrate] ${m}`));
const app = await buildApp(db, env);
await app.listen({ port: env.PORT, host: "0.0.0.0" });

// Prune old data at start-up and once a day, so no cron job is needed.
const tidy = () => prune(db, retentionOf(env)).then(c => app.log.info({ pruned: c }, "retention")).catch(err => app.log.error({ err }, "retention failed"));
tidy();
setInterval(tidy, 24 * 3600e3).unref();
