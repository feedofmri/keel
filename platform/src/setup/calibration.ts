import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The shared calibration that setup pull requests add to repositories as .keel/calibration.json.
// It is produced by the QuixBugs benchmark (results/quixbugs/calibration.json) and copied into
// dist/calibrations at build time. A simulated calibration is never delivered: without a real one,
// repositories set up through the platform label fixes but never merge them automatically.
export const SHARED_REF = "shared-v1";
export const CALIBRATION_PATH = ".keel/calibration.json";

export interface SharedCalibration { ref: string; n: number; source: string; fingerprint: string; json: string }

const here = dirname(fileURLToPath(import.meta.url));
const candidates = (ref: string) => [join(here, "..", "calibrations", `${ref}.json`), join(here, "..", "..", "..", "results", "quixbugs", "calibration.json")];

let cached: SharedCalibration | null | undefined;
export function sharedCalibration(file?: string): SharedCalibration | null {
  if (file === undefined && cached !== undefined) return cached;
  const path = file ?? candidates(SHARED_REF).find(existsSync);
  let out: SharedCalibration | null = null;
  if (path && existsSync(path)) {
    try {
      const json = readFileSync(path, "utf8"), d = JSON.parse(json);
      if (!d.simulated && Array.isArray(d.scores) && d.scores.length && typeof d.fingerprint === "string")
        out = { ref: SHARED_REF, n: d.scores.length, source: String(d.source || "benchmark"), fingerprint: d.fingerprint, json };
    } catch { out = null; }
  }
  if (file === undefined) cached = out;
  return out;
}
