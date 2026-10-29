// Demo mode: the GitHub Pages preview (or ?demo, or a VITE_DEMO build) has no API behind it,
// so the app runs on sample data and says so. ?demo sticks for the tab so client-side navigation keeps it.
const params = new URLSearchParams(window.location.search);
function stickyDemo(): boolean {
  try {
    if (params.has("demo")) sessionStorage.setItem("keel-demo", "1");
    return sessionStorage.getItem("keel-demo") === "1";
  } catch { return params.has("demo"); }
}
export const DEMO = import.meta.env.VITE_DEMO === "1" || window.location.hostname.endsWith("github.io") || stickyDemo();
export const BASE = import.meta.env.BASE_URL; // "/" or "/keel/"
export const asset = (p: string) => BASE + p.replace(/^\//, "");
export const LIVE_URL = "https://keel.boraqs.com";
export const REPO_URL = "https://github.com/feedofmri/keel";
