import { localTestUrl } from "../support/database";
import { beforeAll, afterAll, test, expect } from "bun:test";
import { SQL } from "bun";
import { runInTransaction } from "@getstrata/core/database/transaction";
import migration from "../support/controlled-worksheet/migration";
import { getSql, closeDatabase } from "../../src/bootstrap/database";
import { WorksheetStore } from "../../src/modules/worksheet/store";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";
import { recordJourney } from "../../src/modules/worksheet/journey";
import { purgeExpiredWorksheetContacts } from "../../src/modules/worksheet/retention";
const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
const store = new WorksheetStore();
const role = "clientelo_native_retention_test";
const retention = new SQL(localTestUrl("RETENTION_DATABASE_URL"));
beforeAll(async () => {
  if (new URL(localTestUrl("DATABASE_URL")).pathname !== "/clientelo_native_test")
    throw new Error("Owned isolated fixture only");
  await migration.up(owner);
  await owner.unsafe(
    "GRANT SELECT,INSERT,UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  await owner.unsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await owner.unsafe(
    `GRANT SELECT,DELETE ON worksheet_contact,worksheet_event,worksheet_journey_event TO ${role}`,
  );
  await owner.unsafe(`GRANT UPDATE(id) ON worksheet_contact TO ${role}`);
  getSql();
});
afterAll(async () => {
  await closeDatabase();
  await migration.down!(owner);
  await retention.close();
  await owner.close();
});
test("seven-day cutoff removes expired contacts and associated facts using only the deletion role", async () => {
  const now = new Date("2026-10-26T08:00:00Z");
  const cutoff = new Date(now.getTime() - 7 * 86400000);
  const expired = await store.accept("expired@example.test");
  const retained = await store.accept("retained@example.test");
  await WorksheetContact.repository()
    .query()
    .where({ id: expired.id })
    .update({ created_at: cutoff });
  await WorksheetContact.repository()
    .query()
    .where({ id: retained.id })
    .update({ created_at: new Date(cutoff.getTime() + 1) });
  await recordJourney(crypto.randomUUID(), "resource_visible", {
    acceptanceId: expired.id,
  });
  await runInTransaction(
    async () => {
      const result = await purgeExpiredWorksheetContacts(now);
      expect(result.contacts).toBe(1);
    },
    { connection: retention },
  );
  expect(await WorksheetContact.find(expired.id)).toBeNull();
  expect(await WorksheetContact.find(retained.id)).not.toBeNull();
  expect(
    await WorksheetEvent.query().where({ acceptance_id: expired.id }).get(),
  ).toHaveLength(0);
  expect(
    await WorksheetJourneyEvent.query()
      .where({ acceptance_id: expired.id })
      .get(),
  ).toHaveLength(0);
  expect(
    (
      await owner.unsafe(
        "SELECT has_table_privilege('clientelo_native_runtime','worksheet_contact','DELETE') AS allowed",
      )
    )[0].allowed,
  ).toBe(false);
});
test("outer rollback restores both contact and facts after deletion", async () => {
  const contact = await store.accept("rollback-prune@example.test");
  await WorksheetContact.repository()
    .query()
    .where({ id: contact.id })
    .update({ created_at: new Date("2026-01-01T00:00:00Z") });
  await expect(
    runInTransaction(
      async () => {
        await purgeExpiredWorksheetContacts(new Date("2026-10-26T08:00:00Z"));
        throw new Error("controlled rollback");
      },
      { connection: retention },
    ),
  ).rejects.toThrow("controlled rollback");
  expect(await WorksheetContact.find(contact.id)).not.toBeNull();
  expect(
    await WorksheetEvent.query().where({ acceptance_id: contact.id }).get(),
  ).toHaveLength(1);
});

test("native CLI deletes using its separate identity and rejects migration/runtime identities", async () => {
  const { retentionConnection } =
    await import("../../src/modules/worksheet/retention");
  for (const env of [
    { RETENTION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL },
    { RETENTION_DATABASE_URL: process.env.DATABASE_URL },
    {
      RETENTION_DATABASE_URL: process.env.RETENTION_DATABASE_URL,
      MIGRATION_DATABASE_URL: "forbidden",
    },
  ])
    expect(() => retentionConnection(env)).toThrow();
  const child = Bun.spawnSync(
    [process.execPath, "node_modules/.bin/strata", "worksheet:prune"],
    {
      env: {
        PATH: process.env.PATH!,
        APP_ENV: "production",
        RETENTION_TEST_FIXTURE: "1",
        RETENTION_DATABASE_URL: localTestUrl("RETENTION_DATABASE_URL"),
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (child.exitCode !== 0)
    await Bun.write(
      "/private/tmp/clientelo-retention-command.private.log",
      child.stderr,
    );
  expect(child.exitCode).toBe(0);
  const result = JSON.parse(child.stdout.toString().trim().split("\n").at(-1)!);
  expect(result.event).toBe("worksheet_retention_batch");
  expect(result.automatic_schedule).toBe(false);
  const privileges = await retention.unsafe(
    "SELECT current_user AS role, has_table_privilege(current_user,'worksheet_contact','DELETE') AS can_delete, has_table_privilege(current_user,'worksheet_contact','INSERT') AS can_insert, has_schema_privilege(current_user,'public','CREATE') AS can_create, has_column_privilege(current_user,'worksheet_contact','email','UPDATE') AS can_update_email",
  );
  expect(privileges[0].role).toBe(role);
  expect(privileges[0].can_delete).toBe(true);
  expect(privileges[0].can_insert).toBe(false);
  expect(privileges[0].can_create).toBe(false);
  expect(privileges[0].can_update_email).toBe(false);
});
