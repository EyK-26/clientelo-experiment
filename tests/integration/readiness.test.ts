import { localTestUrl } from "../support/database";
import { expect, test } from "bun:test";
import { SQL } from "bun";
import { worksheetFixture } from "../support/worksheet";
import { closeDatabase } from "../../src/bootstrap/database";
import { runInTransaction } from "@getstrata/core/database/transaction";
import { worksheetSchemaReady } from "../../src/bootstrap/readiness";

const tables = ["worksheet_contact", "worksheet_event", "worksheet_journey_event"];

test("readiness accepts empty worksheet tables and fails for each missing or inaccessible table", async () => {
  const fixture = await worksheetFixture();
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  delete process.env.MIGRATION_DATABASE_URL;
  Object.assign(process.env, {
    APP_PROFILE: "worksheet-qualification", APP_ENV: "test",
    APP_URL: "https://native.clientelo.test", CSRF_TARGET_ORIGIN: "https://native.clientelo.test",
    WORKSHEET_CONTROLLED_TESTS: "0",
  });
  const { bootstrapApp, createAppServer } = await import("../../src/bootstrap/createApp");
  const app = await bootstrapApp({ migrate: false });
  const server = createAppServer(app.routes, 0, undefined, { hostname: "127.0.0.1" });
  const health = () => fetch(new URL("/health", server.url));
  try {
    expect((await health()).status).toBe(200);
    await runInTransaction(async tx => {
      await tx.unsafe("SET TRANSACTION READ ONLY");
      expect(await worksheetSchemaReady()).toBe(true);
    });
    for (const table of tables) {
      // Only isolated fixture tables are renamed; original grants/rows are retained.
      await owner.unsafe(`ALTER TABLE ${table} RENAME TO readiness_saved`);
      try {
        expect((await health()).status).toBe(503);
        // A same-name owner-only table distinguishes inaccessible from absent schema.
        await owner.unsafe(`CREATE TABLE ${table} (id uuid PRIMARY KEY)`);
        try {
          expect((await health()).status).toBe(503);
        } finally {
          await owner.unsafe(`DROP TABLE ${table}`);
        }
      } finally {
        await owner.unsafe(`ALTER TABLE readiness_saved RENAME TO ${table}`);
      }
      expect((await health()).status).toBe(200);
    }
  } finally {
    await server.stop(true);
    await app.context.dispose();
    await closeDatabase();
    await owner.close();
    await fixture.close();
  }
});
