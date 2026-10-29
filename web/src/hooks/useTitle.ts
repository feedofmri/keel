import { useEffect } from "react";
/** Sets the tab title; every page calls this so titles never go stale on client-side navigation. */
export function useTitle(title: string) {
  useEffect(() => { document.title = title; }, [title]);
}
