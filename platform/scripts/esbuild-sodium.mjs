import { readFileSync } from "node:fs";
import { join } from "node:path";

// libsodium's ESM build is broken upstream, so the source loads its CommonJS build with createRequire,
// which esbuild cannot follow. Here the import is made static and pointed at the CommonJS files, so
// libsodium is bundled too and the deploy ships no node_modules at all (a half-uploaded library file
// crashed the server once).
export function sodiumPlugin(root) {
  const sodiumDir = join(root, "node_modules/libsodium-wrappers/dist/modules");
  return {
    name: "libsodium-cjs",
    setup(b) {
      b.onResolve({ filter: /^libsodium-wrappers$/ }, () => ({ path: join(sodiumDir, "libsodium-wrappers.js") }));
      b.onResolve({ filter: /^libsodium$/ }, () => ({ path: join(root, "node_modules/libsodium/dist/modules/libsodium.js") }));
      b.onLoad({ filter: /setup[\\/]secrets\.ts$/ }, args => {
        const src = readFileSync(args.path, "utf8");
        const out = src.replace('createRequire(import.meta.url)("libsodium-wrappers")', "__sodium");
        if (out === src) throw new Error("esbuild-sodium: secrets.ts no longer loads libsodium the expected way");
        return { contents: `import __sodium from "libsodium-wrappers";\n${out}`, loader: "ts" };
      });
    },
  };
}
