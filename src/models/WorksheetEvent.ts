import { defineModel } from "@getstrata/core/database/model";
import { defineTable } from "@getstrata/core/database/table";

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
}

export type { WorksheetEventRecord };
export { WorksheetEvent };
