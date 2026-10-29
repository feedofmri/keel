// Build the deploy folder: the server bundled into one file, so a deploy uploads a few dozen files
// instead of ~4,800 in node_modules (FTP opens one connection per file). Run after `npm run build`.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, process.argv[2] || "../deploy");
// libsodium is loaded with createRequire at runtime, and pg only loads pg-native if asked to.
const external = ["libsodium-wrappers", "pg-native"];
rmSync(out, { recursive: true, force: true });
for (const [entry, file] of [["src/server.ts", "server.mjs"], ["src/jobs/maintenance.ts", "maintenance.mjs"]])
  await build({
    entryPoints: [join(root, entry)], outfile: join(out, file), bundle: true, platform: "node", format: "esm",
    target: "node22", external, minify: true, sourcemap: false, legalComments: "none", logLevel: "warning",
    // CommonJS dependencies call require(); give the ES module bundle one.
    banner: { js: 'import { createRequire as __keelRequire } from "node:module"; const require = __keelRequire(import.meta.url);' },
  });
const copy = (from, to) => cpSync(join(root, from), join(out, to), { recursive: true, filter: f => !f.endsWith(".map") });
copy("dist/db/migrations", "db/migrations");
copy("dist/public", "public");
try { copy("dist/calibrations", "calibrations"); } catch { /* no shared calibration yet */ }
for (const pkg of ["libsodium", "libsodium-wrappers"]) copy(`node_modules/${pkg}`, `node_modules/${pkg}`);
writeFileSync(join(out, "app.cjs"), `// cPanel "Setup Node.js App" startup file (Passenger loads it with require()).
import("./server.mjs").catch(err => { console.error(err); process.exit(1); });
`);
writeFileSync(join(out, "package.json"), JSON.stringify({ name: "keel-platform-deploy", private: true }, null, 2) + "\n");
mkdirSync(join(out, "tmp"), { recursive: true });
console.log(`bundle written to ${out}`);
