import { useEffect, useRef } from "react";
import { halftoneLogo } from "../visuals/halftoneLogo";

export function HalftoneCanvas({ className, pitch, scale }: { className?: string; pitch?: number; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => halftoneLogo(ref.current!, { pitch, scale }), [pitch, scale]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
