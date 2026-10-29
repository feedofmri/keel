// Small animated line drawings for the three Meta models (used on Home and Models).
export const SparkArt = () => (
  <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <g className="spin"><circle cx="60" cy="60" r="44" strokeDasharray="2 5" /><circle cx="104" cy="60" r="4" fill="var(--sig)" stroke="none" /></g>
    <circle cx="60" cy="60" r="14" /><path d="M53 60h14M60 53v14" /></svg>
);
export const OpenArt = ({ id = "cw" }: { id?: string }) => (
  <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><clipPath id={id}><rect x="10" y="20" width="100" height="80" /></clipPath>
    <g clipPath={`url(#${id})`}><g className="drift"><path d="M0 60 q10 -26 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" /><path d="M0 74 q10 -12 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity=".5" /></g></g>
    <path d="M10 100h100" opacity=".5" /></svg>
);
export const GlimmerArt = () => (
  <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M16 96a44 44 0 0 1 88 0" /><path d="M16 96a44 44 0 0 1 22 -38" stroke="var(--sig)" strokeWidth="2" />
    <g className="needle"><path d="M60 96V58" /></g><circle cx="60" cy="96" r="3" fill="currentColor" /></svg>
);
