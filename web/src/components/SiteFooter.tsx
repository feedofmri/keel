import { Link } from "react-router-dom";
import { REPO_URL } from "../lib/env";
import { GetStarted } from "./GetStarted";
import { HalftoneCanvas } from "./HalftoneCanvas";

export function SiteFooter() {
  return (
    <div className="inv" data-dark-zone>
      <footer className="foot"><div className="wrap">
        <div className="foot-grid">
          <div>
            <h2 className="h-sec">Review less. Merge with proof.</h2>
            <div className="ctas start"><GetStarted /><a className="btn" href={REPO_URL}>GitHub</a></div>
          </div>
          <HalftoneCanvas className="logo-field" />
        </div>
        <div className="foot-bottom">
          <span>Keel · MIT · built during the Meta Global AI Developer Hackathon 2026</span>
          <nav aria-label="Footer">
            <Link to="/results">Results</Link>
            <Link to={{ pathname: "/", hash: "#guarantee" }}>Guarantee</Link>
            <a href={`${REPO_URL}/blob/main/HACKATHON.md`}>What we built</a>
            <a href={REPO_URL}>GitHub</a>
          </nav>
        </div>
      </div></footer>
    </div>
  );
}
