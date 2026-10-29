export const NS = "http://www.w3.org/2000/svg";
export function mk(parent: Element, tag: string, at: Record<string, string | number> = {}): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const k in at) e.setAttribute(k, String(at[k]));
  parent.appendChild(e);
  return e;
}
export const cssVar = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** A soft-glow filter for an SVG; returns its id. */
export function glowFilter(svg: SVGSVGElement, id: string, sd = 6): string {
  const d = mk(svg, "defs"), f = mk(d, "filter", { id, x: "-50%", y: "-50%", width: "200%", height: "200%" });
  mk(f, "feGaussianBlur", { stdDeviation: sd });
  return id;
}
