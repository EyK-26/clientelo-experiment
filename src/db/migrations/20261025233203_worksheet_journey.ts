import type { Migration } from "@getstrata/core/database/migrations/types";
import { Schema, resolveDatabaseDriver } from "@getstrata/core/database/schema";
const migration: Migration = {
  name: "0030_worksheet_journey",
  async up(db) {
    await Schema.run(db, resolveDatabaseDriver(), (schema) => {
      schema.create("worksheet_journey_event", (table) => {
        table.uuid("id").primary();
        table.uuid("journey_id");
        table.uuid("acceptance_id").nullable();
        table
          .text("kind")
          .check(
            "kind IN ('page_response_ready','page_visible','form_engaged','submit_attempt','lead_rejected','request_rejected','accepted_new','duplicate_recovered','resource_response_ready','resource_visible','print_attempt')",
          );
        table.text("variant").nullable().check("variant IN ('a','b')");
        table.timestamp("created_at").defaultRaw("NOW()");
        table.unique(["journey_id", "kind"]);
        table.foreignKey(["acceptance_id"], "worksheet_contact", ["id"], {
          onDelete: "restrict",
        });
      });
    });
  },
  async down(db) {
    await Schema.run(db, resolveDatabaseDriver(), (schema) => {
      schema.drop("worksheet_journey_event");
    });
  },
};
export default migration;
