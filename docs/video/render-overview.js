// Render overview.html to a 30-second video, frame by frame (deterministic, 30 fps).
// Usage: node docs/video/render-overview.js [outDir] [--4k]   (needs Playwright's Chromium and ffmpeg)
//   default: 1920x1080 MP4 + WebM + poster for the home page (web/public/media)
//   --4k:    3840x2160 MP4 (H.264, high quality) + poster, e.g. into docs/video/4k
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");

const args = process.argv.slice(2), UHD = args.includes("--4k");
const FPS = 30, SECONDS = 30, out = path.resolve(args.find(a => !a.startsWith("--")) || path.join(__dirname, "out"));
// The scene is laid out at 1280x720; the device scale factor sets the output resolution (1.5 → 1080p, 3 → 4K).
const frames = fs.mkdtempSync(path.join(require("os").tmpdir(), "keel-frames-"));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: UHD ? 3 : 1.5 });
  await page.goto("file://" + path.join(__dirname, "overview.html"));
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  for (let i = 0; i < FPS * SECONDS; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: UHD ? 97 : 92 });
    if (i % 150 === 0) console.log("frame", i);
  }
  await browser.close();
  fs.mkdirSync(out, { recursive: true });
  const enc = (args, file) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.jpg"), ...args, path.join(out, file)]);
  if (UHD) {
    enc(["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-level", "5.1", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"], "keel-overview-4k.mp4");
    fs.copyFileSync(path.join(frames, "f0105.jpg"), path.join(out, "keel-overview-4k-poster.jpg"));
  } else {
    enc(["-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"], "keel-overview.mp4");
    enc(["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-an"], "keel-overview.webm");
    fs.copyFileSync(path.join(frames, "f0105.jpg"), path.join(out, "keel-overview-poster.jpg"));  // 3.5 s: the title frame
  }
  fs.rmSync(frames, { recursive: true, force: true });
  console.log("wrote", out);
})();
