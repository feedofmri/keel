import { useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(margin = "0px 0px -8% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || inView) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setInView(true); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el); return () => io.disconnect();
  }, [inView, margin]);
  return [ref, inView] as const;
}
