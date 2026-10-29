import { Link } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { KeelMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** The top bar for every signed-in page: brand, theme and account. Navigation lives in the sidebar. */
export function AppHeader() {
  return (
    <header className="top app-top">
      <div className="app-bar">
        <Link className="brand" to="/app"><KeelMark />Keel</Link>
        <div className="app-bar-right"><ThemeToggle /><AccountMenu /></div>
      </div>
    </header>
  );
}
