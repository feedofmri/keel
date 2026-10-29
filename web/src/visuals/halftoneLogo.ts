import { reducedMotion } from "./svg";

// The Keel mark rendered as an animated halftone dot field (sea-glass tone ramp).
export const RAMP = ["#0a1312","#0d1a18","#10221f","#132b27","#16352f","#1a4038","#1d4c42","#21594c","#256757","#2a7663","#31876f","#3a997c","#48ab8a","#5cbf99","#7dd3ad","#a8e8c8"];
export const MARK = ["M678 588H906V925C762 896 678 790 678 640Z", "M1090 588H1322C1258 838 1080 990 855 1010C990 880 1060 740 1090 588Z",
  "M906 1026V1340H610C622 1160 742 1030 906 1026Z", "M928 1026C1160 1018 1300 1170 1322 1340H1092C1072 1200 1018 1100 928 1026Z"];

export function halftoneLogo(c: HTMLCanvasElement, { pitch = 8, scale = 0.86 } = {}): () => void {
  const x = c.getContext("2d")!, reduce = reducedMotion();
  let pts: [number, number, number][] = [], Wf = 0, Hf = 0, t0 = 0, vis = false, raf = 0;
  function build() {
    const dp = Math.min(1.5, devicePixelRatio || 1), r = c.getBoundingClientRect();
    Wf = Math.floor(r.width); Hf = Math.floor(r.height);
    if (!Wf || !Hf) return;
    c.width = Wf * dp; c.height = Hf * dp; x.setTransform(dp, 0, 0, dp, 0, 0);
    const off = document.createElement("canvas"); off.width = Wf; off.height = Hf;
    const o = off.getContext("2d")!;
    const sc = Math.min(Wf / 752, Hf / 792) * scale;
    o.translate((Wf - 752 * sc) / 2, (Hf - 792 * sc) / 2); o.scale(sc, sc); o.translate(-590, -568);
    MARK.forEach(d => o.fill(new Path2D(d)));
    const img = o.getImageData(0, 0, Wf, Hf).data; pts = [];
    for (let yy = 0; yy < Hf; yy += pitch * 0.866)
      for (let xx = Math.round(yy / (pitch * 0.866)) % 2 ? pitch / 2 : 0; xx < Wf; xx += pitch)
        if (img[(Math.floor(yy) * Wf + Math.floor(xx)) * 4 + 3] > 128) pts.push([xx, yy, Math.random() * 6.28]);
  }
  function draw(now: number) {
    raf = requestAnimationFrame(draw);
    if (!vis) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000, intro = reduce ? 1 : Math.min(1, t / 1.6);
    x.clearRect(0, 0, Wf, Hf);
    const cx = Wf / 2, cy = Hf / 2, md = Math.hypot(cx, cy);
    for (const [px, py, ph] of pts) {
      const d = Math.hypot(px - cx, py - cy) / md; if (d > intro * 1.1) continue;
      const flash = Math.max(0, 1 - Math.abs(d - intro) * 8) * (1 - intro);
      const v = 0.45 + 0.35 * Math.sin(t * 0.9 + ph + px * 0.01) + 0.2 * Math.sin(t * 0.4 - py * 0.02);
      const lvl = Math.min(15, Math.max(2, Math.floor(v * 15 + flash * 8)));
      x.fillStyle = RAMP[lvl]; x.beginPath(); x.arc(px, py, 1 + lvl / 15 * pitch * 0.3, 0, 6.283); x.fill();
    }
  }
  const io = new IntersectionObserver(es => es.forEach(e => { vis = e.isIntersecting; }));
  io.observe(c);
  const ro = new ResizeObserver(build); ro.observe(c);
  build(); raf = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
}
