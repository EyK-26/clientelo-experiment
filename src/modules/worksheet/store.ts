import { WorksheetJourneyEvent } from "../../models/WorksheetJourneyEvent";
import { recordJourney, type JourneyContext } from "./journey";
import { ForbiddenError } from "@getstrata/core/errors/http";
import { normalizeContactEmail } from "./policy";
import { runInTransaction } from "@getstrata/core/database/transaction";
import { WorksheetContact } from "../../models/WorksheetContact";
import { WorksheetEvent } from "../../models/WorksheetEvent";

// Reusable persistence; runtime/admission policy is enforced before native route registration.
export const CONTROLLED_RESOURCE_VERSION = "controlled-worksheet-v1";

export class WorksheetStore {
  async accept(
    email: string,
    variant: "a" | "b" | null = null,
    journey?: JourneyContext,
  ) {
    email = normalizeContactEmail(email);
    return runInTransaction(async () => {
      const candidateId = crypto.randomUUID();
      const contact = await WorksheetContact.repository().upsert(
        {
          id: candidateId,
          email,
          resource_version: CONTROLLED_RESOURCE_VERSION,
          variant,
        },
        ["email", "resource_version"],
        ["email"],
      );
      if (!contact) throw new Error("Acceptance returned no row");
      const isNew = contact.id === candidateId;
      if (
        !isNew &&
        new Date(contact.created_at).getTime() <= Date.now() - 7 * 86400000
      )
        throw new Error(
          "Retained acceptance expired; deletion must complete before a new request",
        );
      if (isNew) {
        const acceptedContact = WorksheetContact.newFromRecord(contact);
        await acceptedContact.events().create({
          id: crypto.randomUUID(),
          kind: "accepted_new",
        });
      }
      if (journey) {
        await WorksheetJourneyEvent.repository()
          .query()
          .where({ journey_id: journey.id, acceptance_id: null })
          .update({ acceptance_id: contact.id });
        await recordJourney(
          journey.id,
          isNew ? "accepted_new" : "duplicate_recovered",
          { variant: journey.variant, acceptanceId: contact.id },
        );
      }
      return { id: contact.id, isNew };
    });
  }

  async open(id: string): Promise<void> {
    await this.authorize(id);
    await this.recordResourceOpen(id);
  }

  async authorize(id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new ForbiddenError("Acceptance not found");
    const contact = await WorksheetContact.query()
      .where({ id, resource_version: CONTROLLED_RESOURCE_VERSION })
      .first();
    if (
      !contact ||
      new Date(contact.toObject().created_at).getTime() <=
        Date.now() - 7 * 86400000
    )
      throw new ForbiddenError("Acceptance not found");
  }

  private async recordResourceOpen(acceptanceId: string) {
    await WorksheetEvent.repository().upsert(
      {
        id: crypto.randomUUID(),
        acceptance_id: acceptanceId,
        kind: "resource_open",
      },
      ["acceptance_id", "kind"],
      ["kind"],
    );
  }
}
