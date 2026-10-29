import { useSyncExternalStore } from "react";

// One theme store for the whole app, so every toggle and every chart agree.
export type Theme = "light" | "dark";
const root = document.documentElement;
const listeners = new Set<() => void>();
const read = (): Theme => (root.dataset.theme as Theme) || "light";

export function setTheme(t: Theme) {
  root.dataset.theme = t;
  try { localStorage.setItem("keel-theme", t); } catch { /* private mode */ }
  listeners.forEach(l => l());
}
export const toggleTheme = () => setTheme(read() === "dark" ? "light" : "dark");
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useTheme = (): Theme => useSyncExternalStore(subscribe, read);
