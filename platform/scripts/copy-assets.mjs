// Copy SQL migrations and the built web app (web/dist) into dist/ so one folder deploys to cPanel.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const copy = (from, to) => { if (existsSync(from)) { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); } };
copy(join(root, "src/db/migrations"), join(root, "dist/db/migrations"));
if (!existsSync(join(root, "..", "web", "dist", "index.html"))) console.warn("web/dist missing: run `npm run build` in web/ first");
rmSync(join(root, "dist/public"), { recursive: true, force: true }); // no stale pages from older builds
copy(join(root, "..", "web", "dist"), join(root, "dist/public"));
console.log("assets copied");
