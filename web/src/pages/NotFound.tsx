import { Link } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";

export default function NotFound() {
  useTitle("Page Not Found · Keel");
  return (
    <section className="msg-page"><div>
      <div className="code">404</div>
      <h1 className="h-sec">Page not found</h1>
      <p className="p-large">The page you requested does not exist or has been moved.</p>
      <div className="ctas"><Link className="btn primary" to="/">Home</Link><Link className="btn" to="/results">Results</Link><Link className="btn" to="/app">Open app</Link></div>
    </div></section>
  );
}
