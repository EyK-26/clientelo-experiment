import { expect, test } from "bun:test";
import { SQL } from "bun";
import { loadMigrationsFromDirectory, migrateDatabase, freshDatabase } from "@getstrata/core/database/migrations";
import { localTestUrl } from "../support/database";
import { getSql, closeDatabase } from "../../src/bootstrap/database";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";

const expectedTables = [
  "framework_migrations", "worksheet_contact", "worksheet_event", "worksheet_journey_event",
];

test("native migration and fresh rebuild leave only worksheet schema and no application records", async () => {
  localTestUrl("DATABASE_URL");
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  const schema = "worksheet_reset_" + crypto.randomUUID().replaceAll("-", "");
  const migrations = await loadMigrationsFromDirectory(new URL("../../src/db/migrations", import.meta.url).pathname);
  getSql();
  try {
    await owner.begin(async db => {
      // Independent local fixture schema: no public/hosted tables are reset by this test.
      await db.unsafe(`CREATE SCHEMA ${schema}`);
      await db.unsafe(`SET LOCAL search_path TO ${schema}`);
      await migrateDatabase(db, migrations);
      const tables = async () => (await db.unsafe<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname=current_schema() ORDER BY tablename",
      )).map(row => row.tablename);
      expect(await tables()).toEqual(expectedTables);
      const contacts = WorksheetContact.repository().withConnection(db);
      await contacts.upsert({
        id: crypto.randomUUID(), email: "reset@example.test", resource_version: "controlled-worksheet-v1", variant: null,
      }, ["email", "resource_version"], ["email"]);
      expect(await contacts.query().get()).toHaveLength(1);
      await expect(migrations.at(-1)!.down(db)).rejects.toThrow("cannot be restored");
      await freshDatabase(db, migrations, { destructive: true });
      expect(await tables()).toEqual(expectedTables);
      expect(await contacts.query().get()).toHaveLength(0);
      expect(await WorksheetEvent.repository().withConnection(db).query().get()).toHaveLength(0);
      expect(await WorksheetJourneyEvent.repository().withConnection(db).query().get()).toHaveLength(0);
      expect(await db.unsafe("SELECT name FROM framework_migrations")).toHaveLength(migrations.length);
      await db.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    });
  } finally {
    await closeDatabase();
    await owner.close();
  }
});
