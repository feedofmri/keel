import { useEffect, useRef } from "react";
import { asset } from "../lib/env";
import { reducedMotion } from "../visuals/svg";

/**
 * The 30-second product overview (docs/video/overview.html, rendered by render-overview.js).
 * Plays muted while on screen and pauses when scrolled away; never autoplays with reduced motion.
 */
export function ProductVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current!; if (reducedMotion()) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => undefined); else v.pause(); }, { threshold: 0.4 });
    io.observe(v); return () => io.disconnect();
  }, []);
  return (
    <div className="video-frame">
      <video ref={ref} muted loop playsInline controls preload="metadata" poster={asset("media/keel-overview-poster.jpg")}
        aria-label="A 30-second overview of Keel: a failing test, candidate patches from two Meta models, adversarial testing and scoring, the labelled pull request, and the guarantee.">
        <source src={asset("media/keel-overview.webm")} type="video/webm" />
        <source src={asset("media/keel-overview.mp4")} type="video/mp4" />
      </video>
    </div>
  );
}
