// GitHub Pages serves 404.html for unknown paths, so deep links like /keel/app/... still load the SPA.
import { copyFileSync } from "node:fs";
copyFileSync("dist/index.html", "dist/404.html");
console.log("spa fallback written");
