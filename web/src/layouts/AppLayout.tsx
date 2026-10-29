import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { DemoBanner } from "../components/DemoBanner";
import { RequireAuth } from "../components/RequireAuth";

/** Every signed-in page: auth guard, demo banner, app header. */
export function AppLayout() {
  return (
    <RequireAuth>
      <DemoBanner />
      <AppHeader />
      <main className="app" id="main"><div className="wrap"><Outlet /></div></main>
    </RequireAuth>
  );
}
