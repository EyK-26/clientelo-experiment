import { localTestUrl } from "./database";
import { strict as assert } from "node:assert";
import { SQL } from "bun";
import { ensureMigrationsTable } from "@getstrata/core/database/migrations";
import { applyRuntimeGrants } from "../../src/db/deploy";
import migration from "./controlled-worksheet/migration";

// Destructive fixture setup is confined to the owned local test database.
export async function worksheetFixture() {
  const runtime = new URL(localTestUrl("DATABASE_URL"));
  const migrationUrl = new URL(localTestUrl("MIGRATION_DATABASE_URL"));
  for (const url of [runtime, migrationUrl]) {
    assert.equal(url.pathname, "/clientelo_native_test");
    assert(["127.0.0.1", "localhost"].includes(url.hostname));
  }
  assert.equal(runtime.host, migrationUrl.host);
  assert.equal(runtime.username, "clientelo_native_runtime");
  assert.notEqual(runtime.username, migrationUrl.username);
  const owner = new SQL(migrationUrl.href);
  await ensureMigrationsTable(owner);
  await migration.up(owner);
  await applyRuntimeGrants(owner, "clientelo_native_runtime");
  return {
    async close() {
      try {
        await migration.down!(owner);
      } finally {
        await owner.close();
      }
    },
  };
}
