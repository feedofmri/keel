import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Me } from "./types";

interface SessionCtx { me: Me | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<SessionCtx>({ me: null, loading: true, refresh: async () => {}, signOut: async () => {} });

/** One source of truth for "who is signed in", shared by every page. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setMe(await api.me()); setLoading(false); }, []);
  const signOut = useCallback(async () => { await api.signOut(); await refresh(); }, [refresh]);
  useEffect(() => { refresh(); }, [refresh]);
  return <Ctx.Provider value={{ me, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
