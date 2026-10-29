import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { crcThreshold, pct, stats } from "../lib/conformal";
import type { Results } from "../lib/results";
import { createSea, type Sea } from "../visuals/sea";

/** The hero's interactive sea plus the risk-level strip under it. */
export function HeroSea({ data }: { data: Results | null }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), sea = useRef<Sea | null>(null);
  const [alpha, setAlpha] = useState(0.1);
  const cal = data?.slider.cal, test = data?.slider.test;
  const thr = useMemo(() => (cal ? crcThreshold(cal, alpha) : -1), [cal, alpha]);
  const st = test ? stats(test, thr) : null;

  // Dragging reports a score; pick the risk level whose threshold lands closest to it.
  const calRef = useRef(cal); calRef.current = cal;
  useEffect(() => {
    const s = createSea(host.current!, canvas.current!, score => {
      const c = calRef.current; if (!c) return;
      let best = 0.1, bd = 9;
      for (let a = 0.02; a <= 0.5001; a += 0.01) { const th = crcThreshold(c, a), d = Math.abs((th < 0 ? -0.05 : th) - score); if (d < bd) { bd = d; best = +a.toFixed(2); } }
      setAlpha(best);
    });
    sea.current = s; return () => s.destroy();
  }, []);
  useEffect(() => { if (test) sea.current?.setTest(test); }, [test]);
  useEffect(() => { sea.current?.setThreshold(thr); }, [thr]);

  return (
    <>
      <div className="stage-hero" ref={host}>
        <canvas ref={canvas} aria-label="Each bright mark is a held-out bug, placed by its risk score. Marks below the keel line auto-merge. Drag vertically to move the line." />
        <span className="hint">Drag to adjust the threshold</span>
      </div>
      <div className="strip">
        <div className="slider">
          <div className="row"><span className="lab">Risk level α</span><span className="num">{pct(alpha)}</span></div>
          <input type="range" min={0.02} max={0.5} step={0.01} value={alpha} onChange={e => setAlpha(+e.target.value)} aria-label="Risk level alpha" />
        </div>
        <div><div className="lab">Auto-merged</div><div className="num">{st ? st.k : "–"}</div></div>
        <div><div className="lab">To review</div><div className="num">{st ? st.n - st.k : "–"}</div></div>
        <div><div className="lab">Incorrect merges</div><div className="num">{st ? st.w : "–"}</div></div>
      </div>
      {data && <p className="note">
        {data.simulated ? "This preview uses simulated evaluation data until benchmark results are published. " : `Held-out bugs from ${data.datasets.join(" + ")}. `}
        <Link to="/results">Details</Link></p>}
    </>
  );
}
