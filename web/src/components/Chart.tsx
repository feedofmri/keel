import { useEffect, useRef } from "react";
import { useTheme } from "../lib/theme";

/** Hosts an imperative chart; redraws when its inputs, the theme or its width change. */
export function Chart({ draw, deps }: { draw: (host: HTMLDivElement) => void; deps: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const drawRef = useRef(draw); drawRef.current = draw;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawRef.current(ref.current!); }, [theme, ...deps]);
  useEffect(() => {
    let w = 0, t = 0;
    const ro = new ResizeObserver(([e]) => { const nw = Math.round(e.contentRect.width); if (nw === w) return; w = nw;
      clearTimeout(t); t = window.setTimeout(() => drawRef.current(ref.current!), 120); });
    ro.observe(ref.current!); return () => { ro.disconnect(); clearTimeout(t); };
  }, []);
  return <div className="chart" ref={ref} />;
}
