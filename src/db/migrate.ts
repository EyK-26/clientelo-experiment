import { ensureAppDatabase } from "../bootstrap/ensureDatabase.ts";
import { closeDatabase } from "../bootstrap/database.ts";
import { migrateDatabase } from "@getstrata/core/database/migrations";
import { loadStarterMigrations, withMigrationDatabase } from "./migrationRuntime.ts";

export async function migrate() {
  await ensureAppDatabase({ provision: true });
  await withMigrationDatabase(async (db) => {
    await migrateDatabase(db, await loadStarterMigrations());
  });
}

/** The CLI calls this after migrate() so pooled drivers do not hold the process open. */
export async function close() {
  await closeDatabase();
}

if (import.meta.main) {
  await migrate();
  console.log("Database migrated.");
  await close();
  process.exit(0);
}
