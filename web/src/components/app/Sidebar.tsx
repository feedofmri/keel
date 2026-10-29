import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

export const APP_NAV = [
  { group: "Work", items: [{ to: "/app", label: "Overview", icon: "overview", end: true }, { to: "/app/repos", label: "Repositories", icon: "repos" }, { to: "/app/runs", label: "Runs", icon: "runs" }] },
  { group: "Insight", items: [{ to: "/app/calibration", label: "Calibration", icon: "calibration" }, { to: "/app/usage", label: "Usage", icon: "usage" }, { to: "/app/activity", label: "Activity", icon: "activity" }] },
  { group: "Account", items: [{ to: "/app/settings", label: "Settings", icon: "settings" }, { to: "/app/help", label: "Help", icon: "help" }] },
];

/** The one navigation for every signed-in page. On small screens it becomes a scrolling strip. */
export function Sidebar() {
  return (
    <nav className="side-nav" aria-label="App">
      {APP_NAV.map(g => (
        <div className="grp" key={g.group}>
          <h5>{g.group}</h5>
          {g.items.map(i => <NavLink key={i.to} to={i.to} end={"end" in i && i.end}><Icon name={i.icon} />{i.label}</NavLink>)}
        </div>
      ))}
      <div className="grp side-foot">
        <a href={`${import.meta.env.BASE_URL}docs`} target="_blank" rel="noopener"><Icon name="docs" />Docs<Icon name="external" className="ext" /></a>
      </div>
    </nav>
  );
}
