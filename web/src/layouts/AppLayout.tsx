import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { DemoBanner } from "../components/DemoBanner";
import { RequireAuth } from "../components/RequireAuth";
import { Sidebar } from "../components/app/Sidebar";

/** Every signed-in page: auth guard, demo banner, top bar, sidebar. */
export function AppLayout() {
  return (
    <RequireAuth>
      <DemoBanner />
      <AppHeader />
      <div className="shell">
        <Sidebar />
        <main className="app" id="main"><Outlet /></main>
      </div>
    </RequireAuth>
  );
}
