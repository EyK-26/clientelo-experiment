import { runInTransaction } from "@getstrata/core/database/transaction";
import type { SqlDatabaseConnection } from "@getstrata/core/database/baseRepository";
import { WorksheetContact } from "../../models/WorksheetContact";
import { WorksheetEvent } from "../../models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../../models/WorksheetJourneyEvent";

export async function purgeExpiredWorksheetContacts(
  now = new Date(),
  connection?: SqlDatabaseConnection,
) {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid retention time");
  const cutoff = new Date(now.getTime() - 7 * 86400000);
  return runInTransaction(
    async () => {
      const expired = await WorksheetContact.repository()
        .query()
        .where({ created_at: { lte: cutoff } })
        .orderBy({ created_at: "ASC" })
        .limit(500)
        .lockForUpdate()
        .get();
      const ids = expired.map((row) => row.id);
      let events = 0;
      let contacts = 0;
      if (ids.length) {
        events += await WorksheetJourneyEvent.repository()
          .query()
          .whereIn("acceptance_id", ids)
          .delete();
        events += await WorksheetEvent.repository()
          .query()
          .whereIn("acceptance_id", ids)
          .delete();
        contacts = await WorksheetContact.repository()
          .query()
          .whereIn("id", ids)
          .delete();
      }
      const anonymous = await WorksheetJourneyEvent.repository()
        .query()
        .where({ acceptance_id: null, created_at: { lte: cutoff } })
        .limit(500)
        .get();
      if (anonymous.length)
        events += await WorksheetJourneyEvent.repository()
          .query()
          .whereIn(
            "id",
            anonymous.map((row) => row.id),
          )
          .delete();
      return { contacts, events };
    },
    { connection },
  );
}

export function retentionConnection(
  env: Record<string, string | undefined>,
): string {
  const value = env.RETENTION_DATABASE_URL;
  if (
    !value ||
    env.MIGRATION_DATABASE_URL ||
    env.RENDER_API_KEY ||
    env.NEON_API_KEY
  )
    throw new Error(
      "Use a separate deletion identity without administration credentials",
    );
  const url = new URL(value);
  const role = decodeURIComponent(url.username);
  const fixture =
    env.RETENTION_TEST_FIXTURE === "1" &&
    url.pathname === "/clientelo_native_test" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    role === "clientelo_native_retention_test";
  if (
    !fixture &&
    (role !== "clientelo_native_retention" ||
      url.pathname !== "/clientelo_native")
  )
    throw new Error("Restricted deletion identity required");
  return value;
}
