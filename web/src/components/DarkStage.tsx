import { useEffect, useRef, type CSSProperties } from "react";
import { useInView } from "../hooks/useInView";
import type { StageDraw } from "../visuals/stages";

/** A dark diagram stage. Draws its SVG once; its parts animate when it scrolls into view. */
export function DarkStage({ draw, caption, viewBox = "0 0 720 400", className = "", style }:
  { draw: StageDraw; caption?: string; viewBox?: string; className?: string; style?: CSSProperties }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { const s = svg.current!; s.replaceChildren(); draw(s); }, [draw]);
  return (
    <div ref={ref} className={`stage dark inv ${className}${inView ? " in" : ""}`} style={style}>
      <svg ref={svg} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" />
      {caption && <span className="cap">{caption}</span>}
    </div>
  );
}
