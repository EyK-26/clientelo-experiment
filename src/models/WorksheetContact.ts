import { defineModel } from "@getstrata/core/database/model";
import { defineTable } from "@getstrata/core/database/table";

interface WorksheetContactRecord {
  id: string;
  email: string;
  resource_version: string;
  variant: "a" | "b" | null;
  created_at: Date | string;
}

const table = defineTable<WorksheetContactRecord, "id">({
  name: "worksheet_contact",
  primaryKey: "id",
  columns: ["id", "email", "resource_version", "variant", "created_at"],
});

class WorksheetContact extends defineModel(table) {
  static override $fillable = [
    "id",
    "email",
    "resource_version",
    "variant",
    "created_at",
  ] as const;
  static override $timestamps = false;
}

export type { WorksheetContactRecord };
export { WorksheetContact };
