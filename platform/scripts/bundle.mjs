// Build the deploy folder: the server bundled into one file, so a deploy uploads a few dozen files
// instead of ~4,800 in node_modules (FTP opens one connection per file). Run after `npm run build`.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sodiumPlugin } from "./esbuild-sodium.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, process.argv[2] || "../deploy");
// pg only loads pg-native if asked to.
const external = ["pg-native"];

const sodium = sodiumPlugin(root);   // bundles libsodium too, so the deploy ships no node_modules
rmSync(out, { recursive: true, force: true });
for (const [entry, file] of [["src/server.ts", "server.mjs"], ["src/jobs/maintenance.ts", "maintenance.mjs"]])
  await build({
    entryPoints: [join(root, entry)], outfile: join(out, file), bundle: true, platform: "node", format: "esm",
    target: "node22", external, plugins: [sodium], minify: true, sourcemap: false, legalComments: "none", logLevel: "warning",
    // CommonJS dependencies call require() and read __dirname/__filename (libsodium, pino); an ES
    // module has none of these, so the bundle defines them.
    banner: { js: [
      'import { createRequire as __keelRequire } from "node:module";',
      'import { fileURLToPath as __keelPath } from "node:url";',
      'import { dirname as __keelDir } from "node:path";',
      "const require = __keelRequire(import.meta.url);",
      "const __filename = __keelPath(import.meta.url);",
      "const __dirname = __keelDir(__filename);",
    ].join(" ") },
  });
const copy = (from, to) => cpSync(join(root, from), join(out, to), { recursive: true, filter: f => !f.endsWith(".map") });
copy("dist/db/migrations", "db/migrations");
copy("dist/public", "public");
try { copy("dist/calibrations", "calibrations"); } catch { /* no shared calibration yet */ }
writeFileSync(join(out, "app.cjs"), `// cPanel "Setup Node.js App" startup file (Passenger loads it with require()).
import("./server.mjs").catch(err => { console.error(err); process.exit(1); });
`);
writeFileSync(join(out, "package.json"), JSON.stringify({ name: "keel-platform-deploy", private: true }, null, 2) + "\n");
mkdirSync(join(out, "tmp"), { recursive: true });
console.log(`bundle written to ${out}`);
