import { buildApp } from "./app.js";
import { createDb } from "./db/index.js";
import { loadEnv } from "./env.js";
import { migrate } from "./migrate.js";

// Entry point for cPanel's "Setup Node.js App" (Phusion Passenger). Passenger supplies PORT.
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
await migrate(db, m => console.log(`[migrate] ${m}`));
const app = await buildApp(db, env);
await app.listen({ port: env.PORT, host: "0.0.0.0" });
