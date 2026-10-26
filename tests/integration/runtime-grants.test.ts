import { expect, test } from "bun:test";
import { SQL } from "bun";
import { applyRuntimeGrants } from "../../src/db/deploy";
import { localTestUrl } from "../support/database";
import { worksheetFixture } from "../support/worksheet";

test("narrow runtime grants quote valid reserved role names and reject SQL fragments", async () => {
  const fixture = await worksheetFixture();
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  let roleCreated = false;
  try {
    // Role administration and privilege inspection are deliberately infrastructure SQL.
    // Confined to the owned loopback fixture; no hosted identities are changed.
    await owner.unsafe('CREATE ROLE "select" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS');
    roleCreated = true;
    await expect(applyRuntimeGrants(owner, "select; DROP TABLE worksheet_contact"))
      .rejects.toThrow("Invalid runtime role name");

    await applyRuntimeGrants(owner, "select");
    const [rights] = await owner.unsafe<Array<{
      can_read: boolean; can_insert: boolean; can_update: boolean;
      can_delete: boolean; can_truncate: boolean; can_create: boolean;
      can_use_schema: boolean; can_read_history: boolean;
    }>>(`
      SELECT has_table_privilege($1,'worksheet_contact','SELECT') AS can_read,
        has_table_privilege($1,'worksheet_contact','INSERT') AS can_insert,
        has_table_privilege($1,'worksheet_contact','UPDATE') AS can_update,
        has_table_privilege($1,'worksheet_contact','DELETE') AS can_delete,
        has_table_privilege($1,'worksheet_contact','TRUNCATE') AS can_truncate,
        has_schema_privilege($1,'public','CREATE') AS can_create,
        has_schema_privilege($1,'public','USAGE') AS can_use_schema,
        has_table_privilege($1,'framework_migrations','SELECT') AS can_read_history
    `, ["select"]);
    expect(rights).toEqual({
      can_read: true, can_insert: true, can_update: true,
      can_delete: false, can_truncate: false, can_create: false,
      can_use_schema: true, can_read_history: false,
    });
  } finally {
    if (roleCreated) {
      await owner.unsafe('DROP OWNED BY "select"');
      await owner.unsafe('DROP ROLE "select"');
    }
    await owner.close();
    await fixture.close();
  }
});
