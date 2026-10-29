// Copy SQL migrations, the app UI and the marketing site into dist/ so one folder deploys to cPanel.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const copy = (from, to) => { if (existsSync(from)) { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); } };
copy(join(root, "src/db/migrations"), join(root, "dist/db/migrations"));
copy(join(root, "src/ui"), join(root, "dist/ui"));
copy(join(root, "..", "site"), join(root, "dist/public"));
console.log("assets copied");
