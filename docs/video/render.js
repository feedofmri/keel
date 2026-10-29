// Render the motion-graphics scenes to MP4 (1920x1080, 30 fps).
// Usage: python3 -m http.server 8766 (from the repo root), then: node docs/video/render.js
// Needs Playwright (Chromium) and ffmpeg.
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCENES = { hook: 8, pipeline: 12, guarantee: 10, end: 8 };  // seconds
const out = path.join(__dirname, "out");
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  for (const [scene, secs] of Object.entries(SCENES)) {
    const tmp = fs.mkdtempSync(path.join(out, "rec-"));
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 },
      recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } } });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`http://localhost:8766/docs/video/scenes.html?scene=${scene}`);
    const lead = (Date.now() - t0) / 1000;  // page-load time to trim from the start
    await page.waitForTimeout(secs * 1000);
    await ctx.close();
    const webm = fs.readdirSync(tmp).find(f => f.endsWith(".webm"));
    const mp4 = path.join(out, `${scene}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(lead), "-i", path.join(tmp, webm),
      "-t", String(secs), "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", mp4]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log("wrote", mp4);
  }
  await browser.close();
})();
