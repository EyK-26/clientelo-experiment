import { defineModel } from "@getstrata/core/database/model";
import { defineTable } from "@getstrata/core/database/table";
export const journeyKinds = [
  "page_response_ready",
  "page_visible",
  "form_engaged",
  "submit_attempt",
  "lead_rejected",
  "request_rejected",
  "accepted_new",
  "duplicate_recovered",
  "resource_response_ready",
  "resource_visible",
  "print_attempt",
] as const;
export type JourneyKind = (typeof journeyKinds)[number];
interface WorksheetJourneyEventRecord {
  id: string;
  journey_id: string;
  acceptance_id: string | null;
  kind: JourneyKind;
  variant: "a" | "b" | null;
  created_at: Date | string;
}
const table = defineTable<WorksheetJourneyEventRecord, "id">({
  name: "worksheet_journey_event",
  primaryKey: "id",
  columns: [
    "id",
    "journey_id",
    "acceptance_id",
    "kind",
    "variant",
    "created_at",
  ],
});
class WorksheetJourneyEvent extends defineModel(table) {
  static override $fillable = [
    "id",
    "journey_id",
    "acceptance_id",
    "kind",
    "variant",
    "created_at",
  ] as const;
  static override $timestamps = false;
}
export type { WorksheetJourneyEventRecord };
export { WorksheetJourneyEvent };
