import type { Db } from "./index.js";

/**
 * Keel is free to run, so the database keeps only what the app shows. Defaults:
 * - the candidate table of each run for 90 days; after that the run keeps its summary, reasons and
 *   failing tests, which is all the Overview, Runs list, Usage totals and Calibration need;
 * - run summaries and their outcomes for 365 days;
 * - the activity log for 90 days;
 * - expired sessions not at all.
 */
export interface Retention { runDetailDays: number; runDays: number; auditDays: number }

export async function prune(db: Db, r: Retention): Promise<Record<string, number>> {
  const n = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rowCount ?? 0;
  return {
    sessions: await n("delete from sessions where expires_at < now()"),
    runs: await n("delete from runs where created_at < now() - make_interval(days => $1::int)", [r.runDays]),
    details: await n(`update runs set report = (report - 'candidates') || '{"archived": true}'
                       where report ? 'candidates' and created_at < now() - make_interval(days => $1::int)`, [r.runDetailDays]),
    activity: await n("delete from audit_log where at < now() - make_interval(days => $1::int)", [r.auditDays]),
  };
}
