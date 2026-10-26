import { localTestUrl } from "../support/database";
import { expect, test } from "bun:test";
import { SQL } from "bun";
import {
  getMigrationStatus,
  migrateDatabase,
} from "@getstrata/core/database/migrations";

// Real owned PostgreSQL: read-only mode catches even CREATE TABLE IF NOT EXISTS.
test("public migration status reads existing history in a read-only transaction", async () => {
  const url = new URL(localTestUrl("MIGRATION_DATABASE_URL"));
  if (url.pathname !== "/clientelo_native_test")
    throw new Error("Owned native_test only");
  const db = new SQL(url.toString());
  try {
    await migrateDatabase(db, []);
    await db.begin(async (tx) => {
      await tx.unsafe("SET TRANSACTION READ ONLY");
      const rows = await getMigrationStatus(tx, []);
      expect(Array.isArray(rows)).toBe(true);
    });
  } finally {
    await db.close();
  }
});
for (const scenario of [
  "helper-opt-out",
  "helper-default",
  "status-call",
] as const) {
  test(`generated status adoption: ${scenario}`, () => {
    const child = Bun.spawnSync(
      [process.execPath, "tests/support/status-adoption.ts", scenario],
      {
        env: { PATH: process.env.PATH!, MAIL_DRIVER: "log" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(child.stderr.toString()).toBe("");
    expect(child.exitCode).toBe(0);
  });
}

test("status preserves missing-history and denied-history PostgreSQL errors", async () => {
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  const runtime = new SQL(localTestUrl("DATABASE_URL"));
  try {
    await expect(
      owner.begin(async (transaction) => {
        await transaction.unsafe("SET LOCAL search_path TO pg_catalog");
        return getMigrationStatus(transaction, []);
      }),
    ).rejects.toMatchObject({ errno: "42P01" });
    await expect(getMigrationStatus(runtime, [])).rejects.toMatchObject({
      errno: "42501",
    });
  } finally {
    await owner.close();
    await runtime.close();
  }
});
