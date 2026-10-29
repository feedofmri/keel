// Shared site behaviour: theme toggle, scroll reveals, and the conformal maths (mirrors keel/conformal.py).
(() => {
  const root = document.documentElement;
  try { const t = localStorage.getItem("keel-theme"); if (t) root.dataset.theme = t; } catch (e) {}
  const current = () => root.dataset.theme || "light";
  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  function paintBtn() { const b = document.getElementById("theme"); if (b) b.innerHTML = current() === "dark" ? sun : moon; }
  document.addEventListener("DOMContentLoaded", () => {
    paintBtn();
    const b = document.getElementById("theme");
    if (b) b.addEventListener("click", () => {
      root.dataset.theme = current() === "dark" ? "light" : "dark";
      try { localStorage.setItem("keel-theme", root.dataset.theme); } catch (e) {}
      paintBtn();
      window.dispatchEvent(new Event("keel-theme"));
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal, .stage").forEach(el => io.observe(el));
    // Count-up numbers: <span data-count="65" data-suffix="%">
    const cio = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; countUp(e.target); cio.unobserve(e.target); }));
    document.querySelectorAll("[data-count]").forEach(el => cio.observe(el));
    // Soft light that follows the cursor inside .glowfield elements
    document.querySelectorAll(".glowfield").forEach(el => el.addEventListener("pointermove", ev => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (ev.clientX - r.left) + "px"); el.style.setProperty("--my", (ev.clientY - r.top) + "px");
    }));
  });
  function countUp(el) {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || "";
    if (isNaN(to)) return;
    const t0 = performance.now(), dur = 1400;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = (to * e).toFixed(dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- conformal maths ----------
  const NEVER = -1, GATED = 1;
  function crcThreshold(cal, alpha) {
    const n = cal.length; if (!n || 1 / (n + 1) > alpha) return NEVER;
    const pairs = cal.filter(p => p[0] < GATED).sort((a, b) => a[0] - b[0]);
    let loss = 0, best = NEVER, i = 0;
    while (i < pairs.length) {
      const s = pairs[i][0];
      while (i < pairs.length && pairs[i][0] === s) { loss += pairs[i][1]; i++; }
      if ((loss + 1) / (n + 1) <= alpha) best = s; else break;
    }
    return best;
  }
  function lgamma(x) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function binomP(w, k, p) {
    if (k === 0 || w >= k) return 1;
    const terms = []; for (let i = 0; i <= w; i++)
      terms.push(lgamma(k + 1) - lgamma(i + 1) - lgamma(k - i + 1) + i * Math.log(p) + (k - i) * Math.log1p(-p));
    const m = Math.max(...terms); return Math.exp(m + Math.log(terms.reduce((s, t) => s + Math.exp(t - m), 0)));
  }
  const LTT_GRID = [0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  function stats(points, thr) {
    let k = 0, w = 0; for (const p of points) if (p[0] <= thr && p[0] < GATED) { k++; if (p[1]) w++; }
    const n = points.length; return { k, w, n, merge: n ? k / n : 0, risk: n ? w / n : 0, fdr: k ? w / k : 0 };
  }
  function lttThreshold(cal, alpha, delta) {
    let best = NEVER; const level = delta / LTT_GRID.length;
    for (const lam of LTT_GRID) { const s = stats(cal, lam); if (binomP(s.w, s.k, alpha) <= level) best = Math.max(best, lam); }
    return best;
  }
  window.Keel = { NEVER, GATED, crcThreshold, lttThreshold, stats, current, countUp };
})();
