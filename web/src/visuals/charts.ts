import { NEVER, pct, type Point } from "../lib/conformal";
import { cssVar as css, mk as el } from "./svg";

// Results-page charts. Colours come from the theme tokens, so callers redraw on theme change.
export interface Series { key: string; name: string; color?: string; width?: number; dash?: string; label?: string; points: [number, number][] }
export interface LineOpts { label: string; xmax: number; ymax: number; marker?: number; labelRoom?: number; yticks: number[]; xticks: number[] }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const colorOf = (s: Series) => (s.dash ? css("--ink-2") : css(s.color!));

export function lineChart(host: HTMLElement, series: Series[], o: LineOpts) {
  host.innerHTML = "";
  const W = Math.max(300, host.clientWidth || 640), H = W < 520 ? 250 : 300, m = { l: 44, r: o.labelRoom || 16, t: 12, b: 34 };
  const svg = el(host, "svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.label }) as SVGSVGElement;
  const X = (x: number) => m.l + (x / o.xmax) * (W - m.l - m.r), Y = (y: number) => H - m.b - (y / o.ymax) * (H - m.t - m.b);
  for (const t of o.yticks) {
    el(svg, "line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: css(t === 0 ? "--axis" : "--grid"), "stroke-width": 1 });
    el(svg, "text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end", "font-size": 11, fill: css("--muted") }).textContent = pct(t);
  }
  for (const t of o.xticks) el(svg, "text", { x: X(t), y: H - m.b + 18, "text-anchor": "middle", "font-size": 11, fill: css("--muted") }).textContent = pct(t);
  el(svg, "text", { x: W - m.r, y: H - 4, "text-anchor": "end", "font-size": 11, fill: css("--muted") }).textContent = "risk level α →";
  if (o.marker != null) el(svg, "line", { x1: X(o.marker), x2: X(o.marker), y1: m.t, y2: H - m.b, stroke: css("--ink-2"), "stroke-width": 1, "stroke-dasharray": "2 3", opacity: .6 });
  const labels: { text: string; x: number; y: number }[] = [];
  for (const s of series) {
    const d = s.points.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(Math.min(p[1], o.ymax)).toFixed(1)).join("");
    el(svg, "path", { d, fill: "none", stroke: colorOf(s), "stroke-width": s.width || 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": s.dash || "" });
    if (s.label) { const last = s.points[s.points.length - 1]; labels.push({ text: s.label, x: X(last[0]) + 8, y: Y(Math.min(last[1], o.ymax)) + 4 }); }
  }
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 14);
  for (const lb of labels) el(svg, "text", { x: lb.x, y: lb.y, "font-size": 11.5, "font-weight": 500, fill: css("--ink") }).textContent = lb.text;

  // crosshair tooltip
  const tip = document.createElement("div"); tip.className = "tip"; host.appendChild(tip);
  const cross = el(svg, "line", { y1: m.t, y2: H - m.b, stroke: css("--axis"), "stroke-width": 1, opacity: 0 });
  const dots = series.map(s => el(svg, "circle", { r: 4.5, fill: colorOf(s), stroke: css("--surface-1"), "stroke-width": 2, opacity: 0 }));
  const hit = el(svg, "rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
  const xs = series[0].points.map(p => p[0]);
  hit.addEventListener("pointermove", ev => {
    const r = svg.getBoundingClientRect(), px = ((ev as PointerEvent).clientX - r.left) * W / r.width;
    let i = 0, best = 1e9; xs.forEach((x, j) => { const d = Math.abs(X(x) - px); if (d < best) { best = d; i = j; } });
    cross.setAttribute("x1", String(X(xs[i]))); cross.setAttribute("x2", String(X(xs[i]))); cross.setAttribute("opacity", "1");
    series.forEach((s, k) => { dots[k].setAttribute("cx", String(X(s.points[i][0]))); dots[k].setAttribute("cy", String(Y(Math.min(s.points[i][1], o.ymax)))); dots[k].setAttribute("opacity", "1"); });
    tip.innerHTML = `<div class="muted" style="margin-bottom:4px">α = ${pct(xs[i])}</div>` + series.map(s =>
      `<div class="row"><span><span class="sw" style="background:${colorOf(s)}"></span>${esc(s.name)}</span><b>${pct(s.points[i][1], 1)}</b></div>`).join("");
    tip.style.left = Math.min((X(xs[i]) / W) * r.width + 14, r.width - 200) + "px"; tip.style.top = "8px"; tip.style.opacity = "1";
  });
  hit.addEventListener("pointerleave", () => { tip.style.opacity = "0"; cross.setAttribute("opacity", "0"); dots.forEach(d => d.setAttribute("opacity", "0")); });
}

export function histogram(host: HTMLElement, test: Point[], thr: number) {
  host.innerHTML = "";
  const pts = test.filter(p => !p[2]), bins = 20;
  const ok = new Array(bins).fill(0), bad = new Array(bins).fill(0);
  for (const p of pts) { const b = Math.min(bins - 1, Math.floor(p[0] * bins)); (p[1] ? bad : ok)[b]++; }
  const ymax = Math.max(1, ...ok, ...bad);
  const W = Math.max(280, host.clientWidth || 420), H = 260, m = { l: 30, r: 8, t: 12, b: 30 };
  const svg = el(host, "svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Histogram of risk scores" }) as SVGSVGElement;
  const bw = (W - m.l - m.r) / bins, Y = (v: number) => H - m.b - (v / ymax) * (H - m.t - m.b);
  for (let t = 0; t <= ymax; t += Math.max(1, Math.ceil(ymax / 4))) {
    el(svg, "line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: css(t ? "--grid" : "--axis") });
    el(svg, "text", { x: m.l - 6, y: Y(t) + 4, "text-anchor": "end", "font-size": 10.5, fill: css("--muted") }).textContent = String(t);
  }
  [0, 0.25, 0.5, 0.75, 1].forEach(v => { el(svg, "text", { x: m.l + v * (W - m.l - m.r), y: H - m.b + 16, "text-anchor": "middle", "font-size": 10.5, fill: css("--muted") }).textContent = v.toFixed(2); });
  const tip = document.createElement("div"); tip.className = "tip"; host.appendChild(tip);
  for (let b = 0; b < bins; b++) {
    const x0 = m.l + b * bw, half = (bw - 2) / 2;
    ([[ok[b], "--series-1", 0, "Correct"], [bad[b], "--series-2", 1, "Wrong"]] as [number, string, number, string][]).forEach(([v, c, j, name]) => {
      if (!v) return;
      const x = x0 + 1 + j * half + (j ? 1 : 0), w = Math.max(1, half - 1), y = Y(v), h = H - m.b - y, r = Math.min(3, w / 2, h);
      const p = el(svg, "path", { d: `M${x},${H - m.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H - m.b}Z`, fill: css(c) });
      p.addEventListener("pointerenter", () => {
        tip.innerHTML = `<div class="muted">score ${(b / bins).toFixed(2)}–${((b + 1) / bins).toFixed(2)}</div><div class="row"><span>${name}</span><b>${v}</b></div>`;
        const r2 = svg.getBoundingClientRect(); tip.style.left = Math.min((x / W) * r2.width + 10, r2.width - 180) + "px"; tip.style.top = "8px"; tip.style.opacity = "1";
      });
      p.addEventListener("pointerleave", () => { tip.style.opacity = "0"; });
    });
  }
  if (thr > NEVER) {
    const x = m.l + Math.min(1, thr) * (W - m.l - m.r);
    el(svg, "line", { x1: x, x2: x, y1: m.t, y2: H - m.b, stroke: css("--ink"), "stroke-width": 1.5, "stroke-dasharray": "4 3" });
    el(svg, "text", { x: x + 5, y: m.t + 10, "font-size": 11, "font-weight": 500, fill: css("--ink") }).textContent = "λ̂ " + thr.toFixed(3);
  }
}
