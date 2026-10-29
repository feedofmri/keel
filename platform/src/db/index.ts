import pg from "pg";

export type Db = pg.Pool;

export function createDb(url: string): Db {
  // cPanel Postgres listens on localhost; remote databases (if used) usually need TLS.
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || url.includes("host=/");
  return new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000,
                       ssl: local || url.includes("sslmode=disable") ? undefined : { rejectUnauthorized: false } });
}

export async function one<T extends pg.QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] ?? null;
}

export async function many<T extends pg.QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
