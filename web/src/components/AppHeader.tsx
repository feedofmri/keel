import { Link, NavLink } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { KeelMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** The one header for every signed-in page. */
export function AppHeader() {
  return (
    <header className="top app-top">
      <div className="wrap">
        <Link className="brand" to="/app"><KeelMark />Keel</Link>
        <nav className="nav" aria-label="App"><NavLink to="/app">Repositories</NavLink><ThemeToggle /></nav>
        <AccountMenu />
      </div>
    </header>
  );
}
