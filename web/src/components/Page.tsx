import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** The dark band that opens every public page: eyebrow, title, one-line lead, optional actions. */
export function PageIntro({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="inv" data-dark-zone>
      <section className="intro"><div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h-hero">{title}</h1>
        {lead && <p className="p-large">{lead}</p>}
        {children}
      </div></section>
    </div>
  );
}

/** A page section: eyebrow, heading, lead and body. `tone="tint"` gives it the soft grey band. */
export function Section({ id, eyebrow, title, lead, tone, children }:
  { id?: string; eyebrow?: string; title?: ReactNode; lead?: ReactNode; tone?: "tint" | "dark"; children?: ReactNode }) {
  const cls = `sec${tone === "tint" ? " tint" : ""}${tone === "dark" ? " band inv" : ""}`;
  return (
    <section id={id} className={cls} data-dark-zone={tone === "dark" ? "" : undefined}><div className="wrap">
      {(eyebrow || title) && <div className="sec-head">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h2 className="h-sec">{title}</h2>}
        {lead && <p className="p-large">{lead}</p>}
      </div>}
      {children}
    </div></section>
  );
}

/** "Read next" links at the bottom of a page, so every page leads somewhere. */
export function NextLinks({ links }: { links: { to: string; title: string; text: string }[] }) {
  return (
    <section className="sec next"><div className="wrap">
      <span className="eyebrow">Read next</span>
      <div className="next-grid">
        {links.map(l => <Link key={l.to} to={l.to} className="next-card"><h4>{l.title} <span className="arrow">→</span></h4><p className="p-small">{l.text}</p></Link>)}
      </div>
    </div></section>
  );
}

export function Code({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ } };
  return (
    <div className="codeblock inv">
      {lang && <span className="lang">{lang}</span>}
      <button className="copy" onClick={copy} aria-label="Copy code">{copied ? "Copied" : "Copy"}</button>
      <pre><code>{children}</code></pre>
    </div>
  );
}

/** A plain reference table: first column is the key, rendered in mono. */
export function RefTable({ head, rows, mono = true }: { head: string[]; rows: ReactNode[][]; mono?: boolean }) {
  return (
    <div className="table-scroll"><table className="data ref">
      <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 && mono ? "k" : ""}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

/** Columns separated by hairlines; each item is a small heading and a sentence or two. */
export function Points({ items, cols = 3 }: { items: { title: string; text: ReactNode; idx?: string }[]; cols?: 2 | 3 | 4 }) {
  return (
    <div className={`cols points c${cols}`}>
      {items.map(it => <div key={it.title}>{it.idx && <div className="idx">{it.idx}</div>}<h4>{it.title}</h4><p className="p-small">{it.text}</p></div>)}
    </div>
  );
}
