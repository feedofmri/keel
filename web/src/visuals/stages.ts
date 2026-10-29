import type { Results } from "../lib/results";
import { pct } from "../lib/conformal";
import { glowFilter, mk } from "./svg";

// The four "How it works" diagrams and the guarantee chart. They always sit on dark stages, so
// they use fixed dark-palette colours. Their parts animate once the stage gets the .in class.
const C = { sig: "#43e8c4", amb: "#f2b45a", red: "#ff6b5e", ink: "#e2e8e6", ink2: "#a3adaa", mut: "#66716e", b: "rgba(255,255,255,.08)", s2: "#121918", s3: "#1a2220", blue: "#8b98ff" };
const MONO = "JetBrains Mono, monospace";
const text = (p: Element, at: Record<string, string | number>, s: string) => { mk(p, "text", { "font-family": MONO, ...at }).textContent = s; };

export type StageDraw = (svg: SVGSVGElement) => void;

// 01 generate: source node fans out to 10 candidate tiles in two lanes
export const drawGenerate: StageDraw = s => {
  const g = glowFilter(s, "gGen"), root = mk(s, "g", { class: "sway" });
  mk(root, "circle", { cx: 90, cy: 200, r: 30, fill: C.sig, opacity: .25, filter: `url(#${g})`, class: "pulse" });
  mk(root, "rect", { x: 40, y: 182, width: 100, height: 36, rx: 18, fill: C.s2, stroke: C.b });
  text(root, { x: 90, y: 205, "text-anchor": "middle", "font-size": 12, fill: C.ink }, "test ✕");
  for (let i = 0; i < 10; i++) {
    const lane = i < 5 ? 0 : 1, k = i % 5, ang = (-0.9 + k * 0.45) + (lane ? 0.12 : -0.12);
    const R = 300 + lane * 70, x = 90 + Math.cos(ang) * R * 0.95, y = 200 + Math.sin(ang) * R * 0.48;
    mk(root, "path", { d: `M140 200 Q ${(140 + x) / 2} ${200 + (y - 200) * 0.2} ${x - 34} ${y}`, fill: "none", stroke: lane ? C.blue : C.sig, "stroke-opacity": .35, class: "ray", style: `animation-delay:${i * .07}s` });
    const tg = mk(root, "g", { class: "cand", style: `animation-delay:${.25 + i * .07}s` });
    mk(tg, "rect", { x: x - 34, y: y - 20, width: 68, height: 40, rx: 6, fill: C.s2, stroke: C.b });
    ([[0, .6, C.red], [1, .75, C.sig], [2, .45, C.s3]] as const).forEach(([r, w, c]) =>
      mk(tg, "rect", { x: x - 26, y: y - 11 + r * 8, width: 52 * w, height: 4, rx: 2, fill: c, opacity: r === 2 ? 1 : .8 }));
  }
  text(s, { x: 600, y: 52, "font-size": 11, fill: C.sig }, "● muse-spark");
  text(s, { x: 600, y: 70, "font-size": 11, fill: C.blue }, "● spark-open");
};

// 02 attack: 10 x 6 glowing matrix, one column fails
export const drawAttack: StageDraw = s => {
  const g = glowFilter(s, "gAtk");
  const M = [[1,1,1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,1,1,1],[1,1,1,0,1,1,1,1,1,1]];
  const x0 = 150, y0 = 80, dx = 48, dy = 44;
  mk(s, "rect", { x: x0 + 6 * dx - 20, y: y0 - 30, width: 40, height: 6 * dy + 30, rx: 20, fill: C.red, class: "colband" });
  M.forEach((row, i) => {
    text(s, { x: x0 - 30, y: y0 + i * dy + 4, "text-anchor": "end", "font-size": 11, fill: C.mut }, `attack_${i + 1}`);
    row.forEach((v, j) => {
      const cx = x0 + j * dx, cy = y0 + i * dy, c = v ? C.sig : C.red;
      const gg = mk(s, "g", { class: "dotc", style: `animation-delay:${(i * 10 + j) * 0.02}s` });
      mk(gg, "circle", { cx, cy, r: 9, fill: c, opacity: v ? .18 : .35, filter: `url(#${g})` });
      mk(gg, "circle", { cx, cy, r: v ? 4 : 5, fill: c });
    });
  });
  for (let j = 0; j < 10; j++) text(s, { x: x0 + j * dx, y: y0 - 40, "text-anchor": "middle", "font-size": 10, fill: j === 6 ? C.red : C.mut }, "c" + j);
};

// 03 score: bars with threshold
export const drawScore: StageDraw = s => {
  const g = glowFilter(s, "gScore");
  const B: [string, number][] = [["muse-spark·0", .001], ["spark-open·4", .001], ["muse-spark·1", .002], ["spark-open·2", .004], ["muse-spark·4", .011], ["spark-open·1", .939]];
  const x0 = 190, w = 440, T = .375, f = (v: number) => Math.max(.03, Math.pow(v, .42));
  B.forEach(([n, v], i) => {
    const y = 70 + i * 46, c = v <= T ? C.sig : C.amb;
    text(s, { x: x0 - 20, y: y + 4, "text-anchor": "end", "font-size": 11, fill: C.ink2 }, n);
    mk(s, "rect", { x: x0, y: y - 4, width: w, height: 8, rx: 4, fill: C.s3 });
    const bf = mk(s, "g", { class: "barfill", style: `animation-delay:${i * .1}s` });
    mk(bf, "rect", { x: x0, y: y - 4, width: w * f(v), height: 8, rx: 4, fill: c });
    mk(bf, "circle", { cx: x0 + w * f(v), cy: y, r: 10, fill: c, opacity: .35, filter: `url(#${g})` });
  });
  const tx = x0 + w * Math.pow(T, .42);
  mk(s, "line", { x1: tx, x2: tx, y1: 40, y2: 330, stroke: C.ink, "stroke-dasharray": "3 4", opacity: .7 });
  text(s, { x: tx + 8, y: 46, "font-size": 11, fill: C.ink }, "λ̂ 0.375");
};

// 04 decide: keel line splits two PRs
export const drawDecide: StageDraw = s => {
  const g = glowFilter(s, "gDecide");
  mk(s, "line", { x1: 60, x2: 660, y1: 200, y2: 200, stroke: C.sig, "stroke-width": 1.5, opacity: .8 });
  mk(s, "line", { x1: 60, x2: 660, y1: 200, y2: 200, stroke: C.sig, "stroke-width": 10, opacity: .12, filter: `url(#${g})` });
  const row = (y: number, label: string, color: string, title: string, meta: string, delay: number) => {
    const r = mk(s, "g", { class: "prrow", style: `animation-delay:${delay}s` });
    mk(r, "rect", { x: 110, y: y - 30, width: 500, height: 60, rx: 8, fill: C.s2, stroke: C.b });
    mk(r, "circle", { cx: 142, cy: y, r: 5, fill: color }); mk(r, "circle", { cx: 142, cy: y, r: 12, fill: color, opacity: .3, filter: `url(#${g})` });
    text(r, { x: 160, y: y + 4, "font-size": 12, fill: color }, label);
    mk(r, "text", { x: 300, y: y + 5, "font-family": "Instrument Sans, sans-serif", "font-size": 15, fill: C.ink }).textContent = title;
    text(r, { x: 590, y: y + 4, "text-anchor": "end", "font-size": 11, fill: C.mut }, meta);
  };
  row(120, "NEEDS REVIEW", C.amb, "Rounding change", "risk 0.939", .1);
  row(280, "AUTO-MERGE", C.sig, "Fix discount", "risk 0.001", .4);
  text(s, { x: 660, y: 192, "text-anchor": "end", "font-size": 11, fill: C.sig }, "calibrated at α = 10%");
};

// Guarantee: empirical error of Keel and two naive rules against the y = α bound.
export const drawGuarantee = (d: Results): StageDraw => svg => {
  const m = d.evaluation.methods, al = d.evaluation.alphas;
  const Wc = 640, Hc = 360, L = 36, R = 120, T0 = 8, B0 = 28;
  const X = (a: number) => L + a / 0.5 * (Wc - L - R), Y = (v: number) => Hc - B0 - Math.min(v, 0.5) / 0.5 * (Hc - T0 - B0);
  const g = glowFilter(svg, "gGuar");
  for (const v of [0, .25, .5]) {
    mk(svg, "line", { x1: L, x2: Wc - R, y1: Y(v), y2: Y(v), stroke: "rgba(255,255,255,.06)" });
    text(svg, { x: L - 8, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: C.mut }, pct(v));
    text(svg, { x: X(v), y: Hc - 4, "text-anchor": "middle", "font-size": 11, fill: C.mut }, "α " + pct(v));
  }
  const series = [
    { name: "bound", color: C.ink2, dash: "4 6", w: 1.2, pts: al.map(a => [a, a]) },
    { k: "tests_pass", name: "tests pass", color: "#fb7a55", w: 1.6 },
    { k: "self_confidence", name: "self-confidence", color: C.amb, w: 1.6 },
    { k: "keel_crc", name: "Keel", color: C.sig, w: 2.4, glow: true },
  ];
  const labels: { y: number; name: string; color: string }[] = [];
  series.forEach((s, i) => {
    const pts = s.pts || (m[s.k!] || []).map(r => [r.alpha, r.risk]); if (!pts.length) return;
    const dd = pts.map((q, j) => (j ? "L" : "M") + X(q[0]).toFixed(1) + "," + Y(q[1]).toFixed(1)).join("");
    if (s.glow) mk(svg, "path", { d: dd, fill: "none", stroke: s.color, "stroke-width": 8, opacity: .25, filter: `url(#${g})`, class: "gline", style: `animation-delay:${i * .2}s` });
    const p = mk(svg, "path", { d: dd, fill: "none", stroke: s.color, "stroke-width": s.w, "stroke-linecap": "round", "stroke-linejoin": "round", class: s.dash ? "" : "gline" });
    if (s.dash) p.setAttribute("stroke-dasharray", s.dash); else p.style.animationDelay = (i * .2) + "s";
    const lp = pts[pts.length - 1]; labels.push({ y: Y(lp[1]) + 4, name: s.name, color: s.color });
  });
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 16);
  labels.forEach(l => { mk(svg, "text", { x: Wc - R + 12, y: l.y, "font-size": 13, fill: l.color, "font-family": "Instrument Sans, sans-serif" }).textContent = l.name; });
};
