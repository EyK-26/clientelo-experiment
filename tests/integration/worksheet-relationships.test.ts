import { afterAll, beforeAll, expect, test } from "bun:test";
import { runInTransaction } from "@getstrata/core/database/transaction";
import { closeDatabase, getSql } from "../../src/bootstrap/database";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";
import { recordJourney } from "../../src/modules/worksheet/journey";
import { WorksheetStore } from "../../src/modules/worksheet/store";
import { worksheetFixture } from "../support/worksheet";

const store = new WorksheetStore();
let fixture: Awaited<ReturnType<typeof worksheetFixture>>;

beforeAll(async () => {
  fixture = await worksheetFixture();
  getSql();
});

afterAll(async () => {
  await closeDatabase();
  await fixture?.close();
});

test("contact relationships isolate canonical and journey facts by acceptance", async () => {
  const journey = { id: crypto.randomUUID(), variant: "a" as const };
  const accepted = await store.accept(
    `${crypto.randomUUID()}@example.test`, "a", journey,
  );
  await store.open(accepted.id);
  const other = await store.accept(`${crypto.randomUUID()}@example.test`, "b", {
    id: crypto.randomUUID(), variant: "b",
  });

  const contact = (await WorksheetContact.find(accepted.id))!;
  const events = await contact.events().get();
  expect(events.map(event => event.get("kind")).sort()).toEqual([
    "accepted_new", "resource_open",
  ]);
  expect(events.every(event => event.get("acceptance_id") === contact.id)).toBe(true);
  expect(await contact.events().where({ kind: "resource_open" }).count()).toBe(1);
  expect(await contact.events().where({ acceptance_id: other.id }).get())
    .toHaveLength(0);

  const journeyEvents = await contact.journeyEvents().get();
  expect(journeyEvents).toHaveLength(1);
  expect(journeyEvents[0]!.get("journey_id")).toBe(journey.id);
});

test("canonical event resolves its contact through the explicit acceptance foreign key", async () => {
  const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
  const event = (await WorksheetEvent.query()
    .where({ acceptance_id: accepted.id }).first())!;
  const contact = await event.contact().get();
  expect(contact?.id).toBe(accepted.id);
  expect(await event.contact().where({ id: crypto.randomUUID() }).get()).toBeNull();
});

test("journey contact is absent before acceptance and resolves after attachment", async () => {
  const journey = { id: crypto.randomUUID(), variant: "a" as const };
  await recordJourney(journey.id, "page_response_ready", { variant: journey.variant });
  const anonymous = (await WorksheetJourneyEvent.query()
    .where({ journey_id: journey.id }).first())!;
  expect(await anonymous.contact().get()).toBeNull();

  const accepted = await store.accept(
    `${crypto.randomUUID()}@example.test`, "a", journey,
  );
  const attached = (await WorksheetJourneyEvent.find(anonymous.id))!;
  expect((await attached.contact().get())?.id).toBe(accepted.id);
});

test("native eager loading and relationship filters use the declared associations", async () => {
  const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
  await store.open(accepted.id);
  const contact = (await WorksheetContact.with("events", "journeyEvents")
    .where({ id: accepted.id }).first())!;
  expect(contact.loaded<WorksheetEvent[]>("events")).toHaveLength(2);
  expect(contact.loaded<WorksheetJourneyEvent[]>("journeyEvents")).toEqual([]);
  expect((await WorksheetEvent.with("contact")
    .where({ acceptance_id: accepted.id }).first())!
    .loaded<WorksheetContact>("contact")?.id).toBe(accepted.id);
  expect(await WorksheetContact.has("events").where({ id: accepted.id }).get())
    .toHaveLength(1);
  expect(await WorksheetContact.doesntHave("journeyEvents")
    .where({ id: accepted.id }).get()).toHaveLength(1);
});

test("relationship reads share the acceptance transaction and do not escape rollback", async () => {
  let acceptanceId = "";
  await expect(runInTransaction(async () => {
    const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
    acceptanceId = accepted.id;
    const contact = (await WorksheetContact.find(acceptanceId))!;
    const events = await contact.events().get();
    expect(events).toHaveLength(1);
    const event = events[0]!;
    expect(event).toBeInstanceOf(WorksheetEvent);
    if (!(event instanceof WorksheetEvent))
      throw new Error("Expected hydrated event model");
    expect((await event.contact().get())?.id).toBe(acceptanceId);
    throw new Error("rollback relationship fixture");
  })).rejects.toThrow("rollback relationship fixture");
  expect(await WorksheetContact.find(acceptanceId)).toBeNull();
  expect(await WorksheetEvent.query().where({ acceptance_id: acceptanceId }).get())
    .toHaveLength(0);
});
