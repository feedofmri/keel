// Render overview.html to a 30-second MP4 for the home page, frame by frame (deterministic, 30 fps).
// Usage: node docs/video/render-overview.js [outDir]   (needs Playwright's Chromium and ffmpeg)
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");

const FPS = 30, SECONDS = 30, out = path.resolve(process.argv[2] || path.join(__dirname, "out"));
const frames = fs.mkdtempSync(path.join(require("os").tmpdir(), "keel-frames-"));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await page.goto("file://" + path.join(__dirname, "overview.html"));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  for (let i = 0; i < FPS * SECONDS; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 150 === 0) console.log("frame", i);
  }
  await browser.close();
  fs.mkdirSync(out, { recursive: true });
  const enc = (args, file) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"), ...args, path.join(out, file)]);
  enc(["-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"], "keel-overview.mp4");
  enc(["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-an"], "keel-overview.webm");
  fs.copyFileSync(path.join(frames, "f0105.jpg"), path.join(out, "keel-overview-poster.jpg"));  // 3.5 s: the title frame
  fs.rmSync(frames, { recursive: true, force: true });
  console.log("wrote", out);
})();
