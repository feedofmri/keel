import { DEMO, LIVE_URL } from "../lib/env";

export function DemoBanner() {
  if (!DEMO) return null;
  return <div className="demo-banner">Demonstration mode with sample data. The production service is available at <a href={`${LIVE_URL}/app`}>keel.boraqs.com</a>.</div>;
}
