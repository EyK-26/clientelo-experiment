import { WorksheetContact } from "../models/WorksheetContact";
import { WorksheetEvent } from "../models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../models/WorksheetJourneyEvent";

/** Bounded schema/permission reads; no contact data or writes, and no rows required. */
export async function worksheetSchemaReady(): Promise<boolean> {
  try {
    await WorksheetContact.query().limit(1).select("id").get();
    await WorksheetEvent.query().limit(1).select("id").get();
    await WorksheetJourneyEvent.query().limit(1).select("id").get();
    return true;
  } catch {
    return false;
  }
}
