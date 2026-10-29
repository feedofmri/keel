import { useCallback, useEffect, useState } from "react";

/** Loads data for a page; `reload` re-runs the loader without blanking what is on screen. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    try { setData(await run()); setError(null); } catch (e) { setError((e as Error).message); }
  }, [run]);
  useEffect(() => { setData(null); reload(); }, [reload]);
  return { data, error, reload };
}
