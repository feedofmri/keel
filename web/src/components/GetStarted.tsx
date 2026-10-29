import { Link } from "react-router-dom";
import { useSession } from "../lib/session";

/** The primary call to action: sign in when signed out, open the app when signed in. */
export function GetStarted({ label = "Get started" }: { label?: string }) {
  const { me } = useSession();
  return <Link className="btn primary" to={me?.user ? "/app" : "/login"}>{me?.user ? "Open app" : label}</Link>;
}
