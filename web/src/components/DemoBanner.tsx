import { DEMO, LIVE_URL } from "../lib/env";

export function DemoBanner() {
  if (!DEMO) return null;
  return <div className="demo-banner">Demo mode with sample data. The live app runs at <a href={`${LIVE_URL}/app`}>keel.boraqs.com</a>.</div>;
}
