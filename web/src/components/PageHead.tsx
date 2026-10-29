import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { repoPath } from "../lib/format";

/** Breadcrumbs, title and actions for every app page. */
export function PageHead({ crumbs, title, sub, actions, children }: { crumbs?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {crumbs && <div className="crumbs">{crumbs}</div>}
      <div className="page-head">
        <div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}
export const RepoCrumbs = ({ full }: { full: string }) => <><Link to="/app/repos">Repositories</Link> / {full}</>;
export function RepoTabs({ full, canManage }: { full: string; canManage: boolean }) {
  const base = repoPath(full);
  return (
    <nav className="tabs-repo" aria-label="Repository">
      <NavLink end to={base}>Overview</NavLink>
      <NavLink to={`${base}/runs`}>Runs</NavLink>
      <NavLink to={`${base}/activity`}>Activity</NavLink>
      {canManage && <NavLink to={`${base}/settings`}>Settings</NavLink>}
    </nav>
  );
}
