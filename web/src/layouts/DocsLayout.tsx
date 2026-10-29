import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

export const DOCS = [
  { group: "Getting started", items: [{ to: "/docs", label: "Quickstart" }, { to: "/docs/concepts", label: "Concepts" }] },
  { group: "Configure", items: [{ to: "/docs/configuration", label: "Configuration" }, { to: "/docs/github-action", label: "GitHub Action" }, { to: "/docs/calibration", label: "Calibration" }] },
  { group: "Reference", items: [{ to: "/docs/cli", label: "CLI" }, { to: "/docs/evaluation", label: "Evaluation" }] },
  { group: "Help", items: [{ to: "/docs/faq", label: "FAQ" }] },
];
const FLAT = DOCS.flatMap(g => g.items);

/** Docs pages: section sidebar, content, and previous/next links. */
export function DocsLayout() {
  const { pathname } = useLocation();
  const i = FLAT.findIndex(x => x.to === pathname.replace(/\/$/, "")), prev = FLAT[i - 1], next = FLAT[i + 1];
  return (
    <div className="wrap docs">
      <nav className="docs-nav" aria-label="Docs">
        {DOCS.map(g => <div key={g.group} style={{ display: "contents" }}><h5>{g.group}</h5>{g.items.map(l => <NavLink key={l.to} end to={l.to}>{l.label}</NavLink>)}</div>)}
      </nav>
      <article>
        <Outlet />
        <div className="docs-pager">
          {prev && <Link to={prev.to}>← Previous<b>{prev.label}</b></Link>}
          {next && <Link to={next.to}>Next →<b>{next.label}</b></Link>}
        </div>
      </article>
    </div>
  );
}

export function DocHead({ title, lead, group }: { title: string; lead: string; group: string }) {
  return <header className="docs-head"><div className="crumb">Docs / {group}</div><h1>{title}</h1><p className="p-large">{lead}</p></header>;
}
