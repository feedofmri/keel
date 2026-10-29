import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { REPO_URL } from "../lib/env";
import { useSession } from "../lib/session";
import { KeelMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The one header for every public page. It turns dark while it sits over a section marked
 * data-dark-zone (the hero, the guarantee band, the footer), so pages never style it themselves.
 */
export function SiteHeader() {
  const { me } = useSession();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => {
      let d = false;
      document.querySelectorAll("[data-dark-zone]").forEach(z => { const r = z.getBoundingClientRect(); if (r.top <= 32 && r.bottom > 32) d = true; });
      setDark(d);
    };
    sync();
    const ro = new ResizeObserver(sync); ro.observe(document.body);
    addEventListener("scroll", sync, { passive: true });
    return () => { ro.disconnect(); removeEventListener("scroll", sync); };
  }, [pathname]);

  return (
    <header className={`top${dark ? " inv" : ""}`}>
      <div className="wrap">
        <Link className="brand" to="/"><KeelMark />Keel</Link>
        <nav className="nav" aria-label="Main">
          <Link to={{ pathname: "/", hash: "#how" }} className="hide-sm">How it works</Link>
          <Link to={{ pathname: "/", hash: "#guarantee" }} className="hide-sm">Guarantee</Link>
          <NavLink to="/results">Results</NavLink>
          <a href={REPO_URL} className="hide-sm">GitHub</a>
          {me?.user
            ? <Link to="/app" className="btn primary cta">Open app</Link>
            : <NavLink to="/login" className="btn primary cta">Sign in</NavLink>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
