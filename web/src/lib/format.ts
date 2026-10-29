export const ago = (iso: string | null | undefined) => {
  if (!iso) return "–";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};
export const MODEL_NAMES: Record<string, string> = { "muse-spark": "Muse Spark", "muse-spark-open": "Muse Spark Open", "muse-glimmer": "Muse Glimmer" };
export const repoPath = (full: string) => `/app/repos/${full}`;
