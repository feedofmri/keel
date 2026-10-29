import { Link } from "react-router-dom";
import { REPO_URL } from "../lib/env";
import { FOOTER } from "../lib/nav";
import { GetStarted } from "./GetStarted";
import { HalftoneCanvas } from "./HalftoneCanvas";
import { ThemeToggle } from "./ThemeToggle";

export function SiteFooter() {
  return (
    <div className="inv" data-dark-zone>
      <footer className="foot"><div className="wrap">
        <div className="foot-grid">
          <div>
            <h2 className="h-sec">Get started with Keel</h2>
            <div className="ctas start"><GetStarted /><a className="btn" href={REPO_URL}>GitHub</a></div>
          </div>
          <HalftoneCanvas className="logo-field" />
        </div>
        <div className="foot-cols">
          {FOOTER.map(c => (
            <nav key={c.title} aria-label={c.title}>
              <h4>{c.title}</h4>
              {c.links.map(l => l.external ? <a key={l.to} href={l.to}>{l.label}</a> : <Link key={l.to} to={l.to}>{l.label}</Link>)}
            </nav>
          ))}
        </div>
        <div className="foot-bottom">
          <span>© 2026 Keel. Released under the MIT License.</span>
          <span className="theme-row">Theme <ThemeToggle /></span>
        </div>
      </div></footer>
    </div>
  );
}
