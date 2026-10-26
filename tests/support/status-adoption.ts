import { mock } from "bun:test";
import { strict as assert } from "node:assert";
import { pathToFileURL } from "node:url";
const scenario = process.argv[2];
const runtime = pathToFileURL(`${process.cwd()}/src/db/migrationRuntime.ts`);
process.env.DATABASE_URL = "postgres://runtime:synthetic@localhost/fixture";
if (scenario === "status-call") {
  let options: unknown;
  let provision: unknown;
  mock.module(
    new URL("../bootstrap/ensureDatabase.ts", runtime).pathname,
    () => ({
      ensureAppDatabase: async (value: unknown) => {
        provision = value;
      },
    }),
  );
  mock.module(runtime.pathname, () => ({
    loadStarterMigrations: async () => [],
    withMigrationDatabase: async (
      fn: (db: unknown) => Promise<unknown>,
      value: unknown,
    ) => {
      options = value;
      return fn({});
    },
  }));
  mock.module("@getstrata/core/database/migrations", () => ({
    getMigrationStatus: async () => [],
  }));
  const { status } = await import(new URL("./status.ts", runtime).href);
  await status();
  assert.deepEqual(options, { grantRuntimePrivileges: false });
  assert.deepEqual(provision, { provision: false });
} else {
  let grants = 0,
    closed = 0;
  mock.module("@getstrata/core/tenant/enableTenantRls", () => ({
    openPostgresAdminConnection: async () => ({
      close: async () => {
        closed++;
      },
    }),
    grantPostgresAppRolePrivileges: async () => {
      grants++;
    },
    postgresDatabaseNameFromUrl: () => "fixture",
  }));
  const { withMigrationDatabase } = await import(runtime.href);
  await withMigrationDatabase(
    async () => 42,
    ...(scenario === "helper-opt-out"
      ? [{ grantRuntimePrivileges: false }]
      : []),
  );
  assert.equal(grants, scenario === "helper-opt-out" ? 0 : 1);
  assert.equal(closed, 1);
}
