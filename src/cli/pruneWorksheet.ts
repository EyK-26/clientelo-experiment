import { createBunSqlPool } from "@getstrata/core/database/bunSql";
import { bindDatabaseConnection } from "@getstrata/core/database/boundConnection";
import { useSqlDialect } from "@getstrata/core/database/dialect";
import {
  purgeExpiredWorksheetContacts,
  retentionConnection,
} from "../modules/worksheet/retention";

export async function pruneWorksheetCommand(): Promise<void> {
  const url = retentionConnection(process.env);
  const connection = createBunSqlPool({ url, max: 1 });
  useSqlDialect("pgsql");
  bindDatabaseConnection(connection);
  try {
    const result = await purgeExpiredWorksheetContacts(new Date(), connection);
    console.log(
      JSON.stringify({
        event: "worksheet_retention_batch",
        ...result,
        batch_limit: 500,
        automatic_schedule: false,
      }),
    );
  } finally {
    await connection.close?.();
  }
}
