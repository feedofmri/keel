import { Outlet } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

/** Landing, results and 404: shared header and footer. */
export function PublicLayout() {
  return <><a className="skip btn" href="#main">Skip to content</a><SiteHeader /><main id="main"><Outlet /></main><SiteFooter /></>;
}
/** Sign-in: no header or footer; the page fills the screen and has its own Back button. */
export function AuthLayout() {
  return <main id="main"><Outlet /></main>;
}
