import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../lib/session";

/** Private pages render only for a signed-in user; everyone else goes to /login and comes back after. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useSession();
  const loc = useLocation();
  if (loading) return <div className="boot" aria-busy="true">Loading…</div>;
  if (!me?.user) return <Navigate replace to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} />;
  return <>{children}</>;
}
