import { defineModel } from "@getstrata/core/database/model";
import { defineTable } from "@getstrata/core/database/table";
import { WorksheetContact, type WorksheetContactRecord } from "./WorksheetContact";

interface WorksheetEventRecord {
  id: string;
  acceptance_id: string;
  kind: "accepted_new" | "resource_open";
  created_at: Date | string;
}

const table = defineTable<WorksheetEventRecord, "id">({
  name: "worksheet_event",
  primaryKey: "id",
  columns: ["id", "acceptance_id", "kind", "created_at"],
});

class WorksheetEvent extends defineModel(table) {
  static override $fillable = [
    "id",
    "acceptance_id",
    "kind",
    "created_at",
  ] as const;
  static override $timestamps = false;

  contact() {
    return this.belongsTo<WorksheetContactRecord, "id">(
      () => WorksheetContact,
      "acceptance_id",
      "id",
    );
  }
}

export type { WorksheetEventRecord };
export { WorksheetEvent };
