import type { Point } from "../lib/conformal";
import { reducedMotion } from "./svg";
import { RAMP } from "./halftoneLogo";

// Hero: a halftone sea. Each bright mark is a held-out bug placed by its risk score; marks below
// the keel line (the calibrated threshold) auto-merge. Dragging vertically reports the score under
// the pointer so the page can pick the matching risk level.
const AMB = ["#1a1610","#2a2114","#3a2c17","#4c381a","#5e451c","#72521e","#866020","#9c6e22"];
const PITCH = 9;
interface Mark { s: number; wrong: boolean; x: number; sp: number; jy: number; ph: number }
const rgb = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

export interface Sea { setTest(test: Point[]): void; setThreshold(thr: number): void; destroy(): void }

export function createSea(host: HTMLElement, cv: HTMLCanvasElement, onDrag: (score: number) => void): Sea {
  const ctx = cv.getContext("2d")!, reduce = reducedMotion();
  let W = 0, H = 0, dpr = 1, marks: Mark[] = [], thr = -1, lineS = 0.3, visible = true;
  let px = 0, pxs = 0, dragging = false, raf = 0, lastDraw = 0;
  const started = performance.now();
  let sprites: Record<string, HTMLCanvasElement> = {};
  const sOfY = (y: number) => { const f = 1 - (y - 40) / (H - 80); return Math.pow(Math.max(0, Math.min(1, f)), 1 / 0.45); };
  const yOf = (s: number) => 40 + (1 - Math.pow(Math.min(Math.max(s, 0), 0.999), 0.45)) * (H - 80);

  function resize() {
    dpr = Math.min(1.5, devicePixelRatio || 1);
    const r = host.getBoundingClientRect(); W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sprites = {};
  }
  function sprite(color: string, r: number) {
    const key = color + r; if (sprites[key]) return sprites[key];
    const c = document.createElement("canvas"), s = r * 2; c.width = c.height = s * dpr;
    const g = c.getContext("2d")!; g.scale(dpr, dpr);
    const grad = g.createRadialGradient(r, r, 0, r, r, r), [R, G, B] = rgb(color);
    grad.addColorStop(0, `rgba(${R},${G},${B},.9)`); grad.addColorStop(.25, `rgba(${R},${G},${B},.35)`); grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, s, s); return (sprites[key] = c);
  }
  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!visible || now - lastDraw < 25) return; // ~40 fps cap
    lastDraw = now;
    const t = now / 1000, intro = reduce ? 1 : Math.min(1, (now - started) / 1600), ease = 1 - Math.pow(1 - intro, 3);
    pxs += (px - pxs) * 0.08;
    lineS += ((thr < 0 ? -0.04 : thr) - lineS) * (reduce ? 1 : 0.12);
    const ly = thr < 0 ? H - 30 : yOf(lineS);
    ctx.clearRect(0, 0, W, H);

    // halftone field, batched by tone
    const cols = Math.ceil(W / PITCH) + 1, rows = Math.ceil(H / (PITCH * 0.866)) + 1;
    const buckets: number[][] = RAMP.map(() => []), abuckets: number[][] = AMB.map(() => []);
    const cx = W / 2, cy = H * 0.55, maxd = Math.hypot(cx, cy), hot = (pxs * 0.5 + 0.5) * W;
    for (let j = 0; j < rows; j++) {
      const y = j * PITCH * 0.866, off = (j % 2) * PITCH / 2, below = y > ly;
      for (let i = 0; i < cols; i++) {
        const x = i * PITCH + off;
        if (Math.hypot(x - cx, y - cy) / maxd > ease * 1.05) continue;
        let v = 0.5 + 0.22 * Math.sin(x * 0.012 + t * 0.35 + y * 0.004) + 0.18 * Math.sin(x * 0.031 - t * 0.5 + y * 0.02) + 0.1 * Math.sin((x + y) * 0.06 + t * 0.8);
        v *= 0.35 + 0.65 * (y / H);
        v += 0.35 * Math.exp(-((x - hot) ** 2) / 60000) * (y / H);
        v *= Math.max(0, Math.min(1, x / 90, (W - x) / 90, y / 40, (H - y) / 60));
        if (below) { const lvl = Math.max(0, Math.min(15, Math.floor(v * 13))); if (lvl > 1) buckets[lvl].push(x, y); }
        else { const lvl = Math.max(0, Math.min(7, Math.floor(v * 7))); if (lvl > 0) abuckets[lvl].push(x, y); }
      }
    }
    const drawB = (b: number[][], ramp: string[], scale: number) => b.forEach((pts, lvl) => {
      if (!pts.length) return;
      ctx.fillStyle = ramp[lvl]; ctx.beginPath(); const r = (0.6 + lvl / ramp.length * 2.6) * scale;
      for (let k = 0; k < pts.length; k += 2) { ctx.moveTo(pts[k] + r, pts[k + 1]); ctx.arc(pts[k], pts[k + 1], r, 0, 6.283); }
      ctx.fill();
    });
    drawB(abuckets, AMB, 0.9); drawB(buckets, RAMP, 1);

    // data marks (additive glow)
    ctx.globalCompositeOperation = "lighter";
    for (const m of marks) {
      if (!reduce) { m.x += m.sp * 25; if (m.x > 1.04) m.x -= 1.08; }
      const x = m.x * W, y = yOf(m.s) + m.jy * 0.4 + Math.sin(t * 0.9 + m.ph) * 1.4;
      if (Math.hypot(x - cx, y - cy) / maxd > ease) continue;
      const below = thr >= 0 && m.s <= thr, big = 0.55 + 0.45 * (y / H);
      const spr = below ? sprite("#43e8c4", 14) : sprite("#f2b45a", 10), s = (below ? 28 : 20) * big;
      ctx.globalAlpha = below ? 0.95 : 0.55; ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
      ctx.globalAlpha = 1; ctx.fillStyle = below ? "#d9fff4" : "#ffe2b0"; ctx.fillRect(x - 1.2 * big, y - 1.2 * big, 2.4 * big, 2.4 * big);
      if (below && m.wrong) {
        ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = "#ff6b5e"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y, 6 * big + Math.sin(t * 3 + m.ph) * 0.8, 0, 6.283); ctx.stroke(); ctx.globalCompositeOperation = "lighter";
      }
    }
    // the keel line
    const lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, "rgba(67,232,196,0)"); lg.addColorStop(.15, "rgba(67,232,196,.9)"); lg.addColorStop(.85, "rgba(67,232,196,.9)"); lg.addColorStop(1, "rgba(67,232,196,0)");
    ctx.strokeStyle = lg; ctx.lineWidth = 1.5; ctx.globalAlpha = ease;
    ctx.beginPath(); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, ly + Math.sin(x / 80 + t * 1.3) * 1.1); ctx.stroke();
    ctx.lineWidth = 8; ctx.globalAlpha = 0.12 * ease; ctx.stroke();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    const label = thr < 0 ? "no threshold certified · all fixes to review" : `threshold ${thr.toFixed(3)}`;
    ctx.font = "400 12px JetBrains Mono, monospace"; const tw = ctx.measureText(label).width;
    const lx = W / 2 - tw / 2, lyy = Math.max(26, ly - 16);
    ctx.fillStyle = "rgba(5,9,9,.78)"; roundRect(lx - 10, lyy - 14, tw + 20, 21, 10.5); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e2e8e6"; ctx.fillText(label, lx, lyy + 1);
  }

  const localY = (e: PointerEvent) => e.clientY - host.getBoundingClientRect().top;
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect(); px = Math.max(-1.1, Math.min(1.1, ((e.clientX - r.left) / r.width) * 2 - 1));
    if (dragging) onDrag(sOfY(localY(e)));
  };
  const onLeave = () => { px = 0; };
  const onDown = (e: PointerEvent) => { if (e.pointerType === "touch") return; dragging = true; cv.setPointerCapture(e.pointerId); onDrag(sOfY(localY(e))); };
  const onUp = () => { dragging = false; };
  host.addEventListener("pointermove", onMove); host.addEventListener("pointerleave", onLeave);
  cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointerup", onUp);
  const io = new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })); io.observe(host);
  const ro = new ResizeObserver(resize); ro.observe(host);
  resize(); raf = requestAnimationFrame(frame);

  return {
    setTest(test) {
      marks = [];
      const reps = Math.max(1, Math.round(150 / Math.max(1, test.length)));
      test.forEach(p => { if (p[2] || p[0] >= 1) return; for (let r = 0; r < reps; r++)
        marks.push({ s: p[0], wrong: !!p[1], x: Math.random(), sp: 0.000006 + Math.random() * 0.000012, jy: (Math.random() - .5) * 14, ph: Math.random() * 6.28 }); });
    },
    setThreshold(t) { thr = t; },
    destroy() {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointerup", onUp);
    },
  };
}
