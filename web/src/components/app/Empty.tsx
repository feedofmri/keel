import type { ReactNode } from "react";
export function Empty({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return <div className="empty-box"><h3>{title}</h3>{children && <p>{children}</p>}{actions && <div className="ctas">{actions}</div>}</div>;
}
export const Loading = ({ what = "" }: { what?: string }) => <p className="muted" aria-busy="true">Loading{what ? ` ${what}` : ""}…</p>;
