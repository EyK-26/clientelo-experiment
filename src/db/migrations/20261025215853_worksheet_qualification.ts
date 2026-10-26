import type { Migration } from "@getstrata/core/database/migrations/types";
import { Schema, resolveDatabaseDriver } from "@getstrata/core/database/schema";
const migration: Migration = {
  name: "0020_worksheet_qualification",
  async up(db) {
    await Schema.run(db, resolveDatabaseDriver(), (schema) => {
      schema.create("worksheet_contact", (table) => {
        table.uuid("id").primary();
        table.string("email", 254);
        table.text("resource_version");
        table.text("variant").nullable().check("variant IN ('a','b')");
        table.timestamp("created_at").defaultRaw("NOW()");
        table.unique(["email", "resource_version"]);
      });
      schema.create("worksheet_event", (table) => {
        table.uuid("id").primary();
        table.uuid("acceptance_id");
        table.text("kind").check("kind IN ('accepted_new','resource_open')");
        table.timestamp("created_at").defaultRaw("NOW()");
        table.unique(["acceptance_id", "kind"]);
        table.foreignKey(["acceptance_id"], "worksheet_contact", ["id"], {
          onDelete: "restrict",
        });
      });
    });
  },
  async down(db) {
    await Schema.run(db, resolveDatabaseDriver(), (schema) => {
      schema.drop("worksheet_event");
      schema.drop("worksheet_contact");
    });
  },
};
export default migration;
