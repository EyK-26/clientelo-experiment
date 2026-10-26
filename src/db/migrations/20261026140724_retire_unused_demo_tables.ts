import type { Migration } from "@getstrata/core/database/migrations/types";
import { guardMigrationRollback } from "@getstrata/core/database/migrations";
import { Schema, resolveDatabaseDriver } from "@getstrata/core/database/schema";
import starter from "./0001_starter_schema";
import outbox from "./0005_outbox";
import emailExperiment from "./20261025125710_create_experiment_lead";

const migration: Migration = {
  name: "20261026140724_retire_unused_demo_tables",
  async up(db) {
    await Schema.run(db, resolveDatabaseDriver(), schema => {
      schema.drop("strata_outbox_delivery");
      schema.drop("strata_outbox_event");
      schema.drop("experiment_lead");
      schema.drop("notes");
      schema.drop("failed_job");
    });
  },
  async down(db, context) {
    await guardMigrationRollback(context, {
      hasHistory: () => true,
      message: "Retired demo data cannot be restored by rollback; restore a matching database backup.",
    });
    // Explicit local fresh must recreate structures before earlier down() operations.
    // This restores no records and is never presented as a data rollback.
    await starter.up(db);
    await outbox.up(db);
    await emailExperiment.up(db);
  },
};

export default migration;
