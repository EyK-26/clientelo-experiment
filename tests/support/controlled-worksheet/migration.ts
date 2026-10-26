// Native production schemas reused only in the owned local fixture; no startup migrations.
import type { Migration } from "@getstrata/core/database/migrations/types";
import contacts from "../../../src/db/migrations/20261025215853_worksheet_qualification";
import journey from "../../../src/db/migrations/20261025233203_worksheet_journey";
const migration: Migration = {
  name: "worksheet_isolated_fixture",
  async up(db) {
    await contacts.up(db);
    await journey.up(db);
  },
  async down(db) {
    await journey.down!(db);
    await contacts.down!(db);
  },
};
export default migration;
