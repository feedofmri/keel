// Line icons for the app sidebar (16px, currentColor).
const P: Record<string, string> = {
  overview: "M3 3h4v4H3zM9 3h4v6H9zM3 9h4v4H3zM9 11h4v2H9z",
  repos: "M4 2.5h7.5v11H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5zM2.5 11.5A1.5 1.5 0 0 1 4 10h7.5",
  runs: "M2 8h2.5l1.5-4 3 8 1.5-4H14",
  calibration: "M2 13h12M3.5 13V9M6.5 13V6M9.5 13V8M12.5 13V3",
  usage: "M8 2v12M11 4.5H6.75a1.75 1.75 0 0 0 0 3.5h2.5a1.75 1.75 0 0 1 0 3.5H5",
  activity: "M8 4v4l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM13 8a5 5 0 0 0-.1-1l1.4-1.1-1.3-2.2-1.7.6a5 5 0 0 0-1.7-1L9.3 1.5H6.7l-.3 1.8a5 5 0 0 0-1.7 1l-1.7-.6-1.3 2.2L3.1 7a5 5 0 0 0 0 2l-1.4 1.1 1.3 2.2 1.7-.6a5 5 0 0 0 1.7 1l.3 1.8h2.6l.3-1.8a5 5 0 0 0 1.7-1l1.7.6 1.3-2.2L12.9 9c.07-.33.1-.66.1-1z",
  help: "M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M8 11.5v.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0z",
  docs: "M4 2h6l3 3v9H4zM10 2v3h3M6 8h5M6 11h5",
  external: "M9 3h4v4M13 3L7 9M11 9.5V13H3V5h3.5",
};
export function Icon({ name, className }: { name: keyof typeof P | string; className?: string }) {
  return <svg className={className} viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[name]} /></svg>;
}
