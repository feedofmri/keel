import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { RunFilter, RunRow } from "../../lib/types";
import { Empty, Loading } from "./Empty";
import { RunsList } from "./RunsList";

const VIEWS: [string, string, RunFilter][] = [
  ["all", "All", {}], ["review", "Needs review", { decision: "review" }], ["auto", "Auto-merged", { decision: "auto" }],
  ["open", "Open pull requests", { outcome: "open" }], ["wrong", "Incorrect", { outcome: "wrong" }],
];

/** Filterable, paginated runs. The view lives in the URL (?view=review) so it can be linked and survives reloads. */
export function RunsBrowser({ repo, repos }: { repo?: string; repos?: string[] }) {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || (params.get("decision") === "review" ? "review" : "all");
  const repoFilter = repo || params.get("repo") || "";
  const [rows, setRows] = useState<RunRow[] | null>(null), [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState(""), [more, setMore] = useState(false);
  const filter = (): RunFilter => ({ ...VIEWS.find(v => v[0] === view)![2], repo: repoFilter || undefined });

  useEffect(() => {
    let live = true; setRows(null); setError("");
    api.runs(filter()).then(r => { if (live) { setRows(r.runs); setNext(r.next); } }).catch(e => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, repoFilter]);

  const loadMore = async () => { if (!next) return; setMore(true);
    try { const r = await api.runs({ ...filter(), before: next }); setRows(x => [...(x || []), ...r.runs]); setNext(r.next); } catch (e) { setError((e as Error).message); }
    setMore(false); };
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); p.delete("decision"); setParams(p, { replace: true }); };

  return (
    <>
      <div className="toolbar">
        <div className="chips">{VIEWS.map(([k, label]) => <button key={k} className="chip" aria-pressed={view === k} onClick={() => set("view", k === "all" ? "" : k)}>{label}</button>)}</div>
        {repos && repos.length > 1 && (
          <select className="select" value={repoFilter} onChange={e => set("repo", e.target.value)} aria-label="Repository">
            <option value="">All repositories</option>{repos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>
      {error ? <p className="err">{error}</p> : !rows ? <Loading what="runs" /> : rows.length ? (
        <>
          <RunsList runs={rows} showRepo={!repo} />
          {next && <button className="btn load-more" disabled={more} onClick={loadMore}>{more ? "Loading…" : "Load more"}</button>}
        </>
      ) : <Empty title={view === "all" ? "No runs yet" : "No runs match this filter"}>Keel runs when CI fails, on <code>/keel fix</code>, or when you press Fix now on a repository.</Empty>}
    </>
  );
}
