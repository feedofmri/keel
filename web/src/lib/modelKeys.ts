// The repository secrets each model reads, as form fields: [secret name, label, input type, default].
export type KeyField = [id: string, label: string, type: "text" | "password", def: string];
export const KEYS: Record<string, KeyField[]> = {
  "muse-spark": [["KEEL_MUSE_SPARK_BASE_URL", "Base URL", "text", ""], ["KEEL_MUSE_SPARK_API_KEY", "API key", "password", ""], ["KEEL_MUSE_SPARK_MODEL", "Model id", "text", ""]],
  "muse-spark-open": [["KEEL_SPARK_OPEN_API_KEY", "Baseten API key", "password", ""], ["KEEL_SPARK_OPEN_MODEL", "Model id", "text", "meta-models/muse-spark-open-1026"]],
  "muse-glimmer": [["KEEL_GLIMMER_BASE_URL", "Base URL", "text", ""], ["KEEL_GLIMMER_API_KEY", "API key", "password", ""], ["KEEL_GLIMMER_MODEL", "Model id", "text", ""]],
};
