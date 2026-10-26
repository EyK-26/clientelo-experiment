import type { Migration } from "@getstrata/core/database/migrations/types";

const migration: Migration = {
  name: "0001_starter_schema",
  async up(db) {
    await db.unsafe("CREATE TABLE IF NOT EXISTS failed_job (\n    id SERIAL PRIMARY KEY,\n    job_name TEXT NOT NULL,\n    job_id TEXT,\n    payload JSONB NOT NULL,\n    exception TEXT NOT NULL,\n    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n  )");
    await db.unsafe("CREATE TABLE IF NOT EXISTS notes (\n    id SERIAL PRIMARY KEY,\n    body TEXT NOT NULL,\n    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n  )");
  },
  async down(db) {
    await db.unsafe("DROP TABLE IF EXISTS failed_job CASCADE");
    await db.unsafe("DROP TABLE IF EXISTS notes CASCADE");
  },
};

export default migration;
