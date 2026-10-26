import { localTestUrl } from "../support/database";
import { beforeAll, afterAll, test, expect } from "bun:test";
import { SQL } from "bun";
import migration from "../support/controlled-worksheet/migration";
import { getSql, closeDatabase } from "../../src/bootstrap/database";
import {
  recordJourney,
  JourneyRequest,
} from "../../src/modules/worksheet/journey";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";
const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
beforeAll(async () => {
  if (new URL(localTestUrl("DATABASE_URL")).pathname !== "/clientelo_native_test")
    throw new Error("Isolated fixture only");
  await migration.up(owner);
  await owner.unsafe(
    "GRANT SELECT,INSERT,UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  getSql();
});
afterAll(async () => {
  await closeDatabase();
  await migration.down!(owner);
  await owner.close();
});
test("journey facts deduplicate without storing contact input or replacing first attribution", async () => {
  const id = crypto.randomUUID();
  await recordJourney(id, "page_response_ready", { variant: "a" });
  await Promise.all(
    Array.from({ length: 6 }, () =>
      recordJourney(id, "page_response_ready", { variant: "b" }),
    ),
  );
  const facts = await WorksheetJourneyEvent.query().get();
  expect(facts).toHaveLength(1);
  expect(facts[0]!.toObject()).not.toHaveProperty("email");
  expect(facts[0]!.toObject().variant).toBe("a");
});
test("browser facts cannot claim server acceptance and repeated fields are rejected", () => {
  expect(
    new JourneyRequest().validatePayload({ kind: ["form_engaged"] }),
  ).toEqual({ kind: "form_engaged" });
  for (const kind of [
    ["accepted_new"],
    ["resource_response_ready"],
    ["form_engaged", "form_engaged"],
    [new File(["x"], "kind.txt")],
    ["reader@example.org"],
  ])
    expect(() => new JourneyRequest().validatePayload({ kind })).toThrow();
});

test("analytics admission rejects contact fields instead of accepting extra payload", () => {
  expect(() =>
    new JourneyRequest().validatePayload({
      kind: ["form_engaged"],
      email: ["reader@example.org"],
    }),
  ).toThrow();
});
