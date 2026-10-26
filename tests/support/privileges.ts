import { localTestUrl } from "./database";
import { strict as assert } from "node:assert";
import { getSql, closeDatabase } from "../../src/bootstrap/database";
import { runInTransaction } from "@getstrata/core/database/transaction";
import { worksheetSchemaReady } from "../../src/bootstrap/readiness";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";
import { WorksheetStore } from "../../src/modules/worksheet/store";
import { recordJourney } from "../../src/modules/worksheet/journey";

const worksheetTables = ["worksheet_contact", "worksheet_event", "worksheet_journey_event"];

export async function verifyRuntimePrivileges() {
  const db = getSql();
  // PostgreSQL role/ACL inspection and forbidden-operation probes are infrastructure SQL.
  const [role] = await db.unsafe<any>(`
    SELECT r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolbypassrls,r.rolreplication,
      has_schema_privilege(current_user,'public','CREATE') AS schema_create,
      has_schema_privilege(current_user,'public','USAGE') AS schema_usage,
      (SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships,
      (SELECT count(*)::int FROM pg_database WHERE datdba=r.oid) AS databases_owned,
      (SELECT count(*)::int FROM pg_namespace WHERE nspowner=r.oid) AS schemas_owned,
      (SELECT count(*)::int FROM pg_class WHERE relowner=r.oid) AS relations_owned
    FROM pg_roles r WHERE rolname=current_user
  `);
  for (const key of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolinherit", "rolbypassrls", "rolreplication", "schema_create"])
    assert.equal(role[key], false);
  assert.equal(role.schema_usage, true);
  for (const key of ["memberships", "databases_owned", "schemas_owned", "relations_owned"])
    assert.equal(role[key], 0);

  for (const table of [...worksheetTables, "framework_migrations"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
      const [result] = await db.unsafe<any>(
        "SELECT has_table_privilege(current_user,$1,$2) AS allowed", ["public." + table, privilege],
      );
      assert.equal(result.allowed, table !== "framework_migrations" && ["SELECT", "INSERT", "UPDATE"].includes(privilege));
    }
  }
  const [sequence] = await db.unsafe<{ allowed: number }>(`
    SELECT count(*)::int AS allowed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S' AND (
      has_sequence_privilege(current_user,c.oid,'USAGE') OR
      has_sequence_privilege(current_user,c.oid,'SELECT') OR
      has_sequence_privilege(current_user,c.oid,'UPDATE'))
  `);
  assert.equal(sequence!.allowed, 0);

  const rollback = new Error("Rollback successful permission probe");
  const store = new WorksheetStore();
  const email = crypto.randomUUID() + "@example.test";
  const journey = { id: crypto.randomUUID(), variant: "a" as const };
  let acceptanceId = "";
  try {
    await runInTransaction(async () => {
      assert.equal(await worksheetSchemaReady(), true);
      await recordJourney(journey.id, "page_response_ready", { variant: "a" });
      const accepted = await store.accept(email, "a", journey);
      acceptanceId = accepted.id;
      assert.equal(accepted.isNew, true);
      assert.equal((await store.accept(email, "b", journey)).isNew, false);
      await store.open(accepted.id);
      await store.open(accepted.id);
      await WorksheetContact.repository().query().where({ id: accepted.id }).update({ variant: "b" });
      assert.equal((await WorksheetContact.find(accepted.id))!.toObject().variant, "b");
      assert.equal((await WorksheetEvent.query().where({ acceptance_id: accepted.id }).get()).length, 2);
      assert((await WorksheetJourneyEvent.query().where({ acceptance_id: accepted.id }).get()).length > 0);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal((await WorksheetContact.query().where({ email }).get()).length, 0);
  assert.equal((await WorksheetEvent.query().where({ acceptance_id: acceptanceId }).get()).length, 0);
  assert.equal((await WorksheetJourneyEvent.query().where({ journey_id: journey.id }).get()).length, 0);

  for (const sql of [
    "CREATE TABLE public.native_forbidden_probe(id int)",
    ...worksheetTables.flatMap(table => ["DELETE FROM " + table + " WHERE false", "TRUNCATE " + table]),
  ]) {
    let denied = false;
    try {
      await runInTransaction(async tx => {
        await tx.unsafe(sql);
        throw new Error("Unexpectedly permitted; rollback");
      });
    } catch (error) {
      denied = (error as { errno?: string }).errno === "42501";
    }
    assert.equal(denied, true);
  }
  return {
    restricted_role: true, separate_nonowning_runtime: true, schema_create: false,
    worksheet_tables: worksheetTables, table_rights: "SELECT INSERT UPDATE only",
    migration_history_access: false, unused_sequence_rights: false,
    orm_acceptance_resource_and_duplicates: true, probe_records_rolled_back: true,
    actual_create_delete_truncate_denied: "42501", probes: "transactional; no retained rows or privilege changes",
  };
}

if (import.meta.main) try {
  localTestUrl("DATABASE_URL");
  console.log(JSON.stringify(await verifyRuntimePrivileges()));
} catch {
  console.log(JSON.stringify({ privilege_check: "failed", private_values_excluded: true }));
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
