import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH is "/" on keel.boraqs.com and "/keel/" for the GitHub Pages preview.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  server: { proxy: { "/api": "http://localhost:3000", "/auth": "http://localhost:3000" } },
});
