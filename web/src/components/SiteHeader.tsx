import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { REPO_URL } from "../lib/env";
import { PRIMARY } from "../lib/nav";
import { useSession } from "../lib/session";
import { KeelMark } from "./Logo";

/**
 * The one header for every public page. It turns dark while it sits over a section marked
 * data-dark-zone (a hero, a dark band, the footer), so pages never style it themselves.
 */
export function SiteHeader() {
  const { me } = useSession();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
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

  const cta = me?.user ? <Link to="/app" className="btn primary cta">Open app</Link> : <NavLink to="/login" className="btn primary cta">Sign in</NavLink>;
  return (
    <header className={`top${dark && !open ? " inv" : ""}${open ? " open" : ""}`}>
      <div className="wrap">
        <Link className="brand" to="/"><KeelMark />Keel</Link>
        <nav className="nav" aria-label="Main">
          {PRIMARY.map(l => <NavLink key={l.to} to={l.to} className="hide-md">{l.label}</NavLink>)}
          <a href={REPO_URL} className="hide-md">GitHub</a>
          {cta}
          <button className="menu-btn" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}</svg>
          </button>
        </nav>
      </div>
      {open && (
        <nav className="mobile-nav" aria-label="Main">
          {PRIMARY.map(l => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          <NavLink to="/compare">Compare</NavLink><NavLink to="/security">Security</NavLink><NavLink to="/about">About</NavLink>
          <a href={REPO_URL}>GitHub</a>
        </nav>
      )}
    </header>
  );
}
