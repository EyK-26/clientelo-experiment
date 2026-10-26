import { createBunSqlPool } from "@getstrata/core/database/bunSql";
import type { SqlDatabaseConnection } from "@getstrata/core/database/baseRepository";
import { bindDatabaseConnection } from "@getstrata/core/database/boundConnection";
import {
  getDefaultDatabaseQuery,
  registerDefaultDatabasePool,
} from "@getstrata/core/database/defaultConnection";
import { useSqlDialect } from "@getstrata/core/database/dialect";

export type SqlClient = SqlDatabaseConnection;

let sql: SqlClient | null = null;

export function getSql(): SqlClient {
  if (sql) {
    return sql;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  useSqlDialect("pgsql");
  const pool = createBunSqlPool({ url, max: 5 }) as SqlDatabaseConnection;
  registerDefaultDatabasePool(pool);
  bindDatabaseConnection(getDefaultDatabaseQuery());
  sql = getDefaultDatabaseQuery();
  return sql;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await getSql().unsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase() {
  if (sql?.close) {
    await sql.close();
  }
  sql = null;
}
