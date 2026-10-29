import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { repoPath } from "../lib/format";

/** Breadcrumbs, title and actions for every app page; repository pages add the Overview/Settings tabs. */
export function PageHead({ crumbs, title, actions, children }: { crumbs?: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {crumbs && <div className="crumbs">{crumbs}</div>}
      <div className="page-head">
        <div><h1>{title}</h1>{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}
export const RepoCrumbs = ({ full }: { full: string }) => <><Link to="/app">Repositories</Link> / {full}</>;
export function RepoTabs({ full, canManage }: { full: string; canManage: boolean }) {
  return (
    <nav className="tabs-repo" aria-label="Repository">
      <NavLink end to={repoPath(full)}>Overview</NavLink>
      {canManage && <NavLink to={`${repoPath(full)}/settings`}>Settings</NavLink>}
    </nav>
  );
}
