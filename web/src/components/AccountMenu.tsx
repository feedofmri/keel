import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";

export function AccountMenu() {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const u = me?.user; if (!u) return null;
  return (
    <div className="who" ref={ref}>
      <button className="acct" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {u.avatar_url && <img src={u.avatar_url} alt="" width={24} height={24} />}<span className="hide-sm">{u.login}</span>
      </button>
      {open && (
        <div className="menu" role="menu" onClick={() => setOpen(false)}>
          <div className="menu-head">Signed in as <b>{u.login}</b></div>
          <Link role="menuitem" to="/app/settings">Account settings</Link>
          <Link role="menuitem" to="/app/settings/github">GitHub access</Link>
          <Link role="menuitem" to="/">Keel website</Link>
          <button role="menuitem" onClick={async () => { navigate("/"); await signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
