import { Outlet } from "react-router-dom";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

/** Landing, results and 404: shared header and footer. */
export function PublicLayout() {
  return <><a className="skip btn" href="#main">Skip to content</a><SiteHeader /><main id="main"><Outlet /></main><SiteFooter /></>;
}
/** Sign-in: the same header, no footer (the page fills the screen). */
export function AuthLayout() {
  return <><SiteHeader /><main id="main"><Outlet /></main></>;
}
