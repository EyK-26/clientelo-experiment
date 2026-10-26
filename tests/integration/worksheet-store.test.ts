import { localTestUrl } from "../support/database";
import { beforeAll, afterAll, test, expect } from "bun:test";
import { SQL } from "bun";
import { getSql, closeDatabase } from "../../src/bootstrap/database";
import migration from "../support/controlled-worksheet/migration";
import { runInTransaction } from "@getstrata/core/database/transaction";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetStore } from "../../src/modules/worksheet/store";
const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
const store = new WorksheetStore();
beforeAll(async () => {
  if (new URL(localTestUrl("DATABASE_URL")).pathname !== "/clientelo_native_test")
    throw new Error("Owned native_test only");
  await migration.up(owner);
  await owner.unsafe(
    "GRANT SELECT, INSERT, UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  getSql();
});
afterAll(async () => {
  await closeDatabase();
  await migration.down!(owner);
  await owner.close();
});
test("concurrent admissions commit one contact and one accepted fact", async () => {
  const email = `${crypto.randomUUID()}@example.test`;
  const results = await Promise.all(
    Array.from({ length: 12 }, () => store.accept(email, "a")),
  );
  expect(new Set(results.map((x) => x.id)).size).toBe(1);
  expect(results.filter((x) => x.isNew)).toHaveLength(1);
  expect(await WorksheetContact.query().where({ email }).get()).toHaveLength(1);
  expect(
    await WorksheetEvent.query()
      .where({ acceptance_id: results[0]!.id, kind: "accepted_new" })
      .get(),
  ).toHaveLength(1);
  expect(
    await WorksheetEvent.query()
      .where({ acceptance_id: results[0]!.id, kind: "resource_open" })
      .get(),
  ).toHaveLength(0);
});

test("only the winning acceptance creates an event through the native model lifecycle", async () => {
  const acceptanceIds: string[] = [];
  let observing = true;
  WorksheetEvent.observe({
    creating(event) {
      if (observing && event.get("kind") === "accepted_new")
        acceptanceIds.push(String(event.get("acceptance_id")));
    },
  });
  try {
    const email = `${crypto.randomUUID()}@example.test`;
    const results = await Promise.all(
      Array.from({ length: 12 }, () => store.accept(email, "a")),
    );
    expect(results.filter(result => result.isNew)).toHaveLength(1);
    expect(acceptanceIds).toEqual([results[0]!.id]);
    const contact = (await WorksheetContact.find(results[0]!.id))!;
    expect(await contact.events().count()).toBe(1);
  } finally {
    observing = false;
  }
});

test.each(["cancel", "created failure"] as const)(
  "native event %s rolls back the contact and its facts",
  async failure => {
    const email = `${crypto.randomUUID()}@example.test`;
    const journey = { id: crypto.randomUUID(), variant: "a" as const };
    let acceptanceId = "";
    let observing = true;
    WorksheetEvent.observe({
      creating(event) {
        if (!observing || event.get("kind") !== "accepted_new") return;
        acceptanceId = String(event.get("acceptance_id"));
        if (failure === "cancel") return false;
      },
      created(event) {
        if (
          observing &&
          event.get("kind") === "accepted_new" &&
          failure === "created failure"
        )
          throw new Error("controlled event observer failure");
      },
    });
    try {
      await expect(store.accept(email, "a", journey)).rejects.toThrow(
        failure === "cancel"
          ? "cancelled by an observer"
          : "controlled event observer failure",
      );
      expect(acceptanceId).not.toBe("");
      expect(await WorksheetContact.query().where({ email }).get()).toHaveLength(0);
      expect(await WorksheetEvent.query().where({ acceptance_id: acceptanceId }).get())
        .toHaveLength(0);
      const { WorksheetJourneyEvent } =
        await import("../../src/models/WorksheetJourneyEvent");
      expect(await WorksheetJourneyEvent.query().where({ journey_id: journey.id }).get())
        .toHaveLength(0);
    } finally {
      observing = false;
    }
  },
);

test("lost response retry preserves original identity, attribution and timestamp", async () => {
  const email = `${crypto.randomUUID()}@example.test`;
  const first = await store.accept(email, "a");
  const before = (await WorksheetContact.find(first.id))!.toObject();
  const retry = await store.accept(email, "b");
  expect(retry).toEqual({ id: first.id, isNew: false });
  expect((await WorksheetContact.find(first.id))!.toObject()).toEqual(before);
  expect(
    await WorksheetEvent.query()
      .where({ acceptance_id: first.id, kind: "accepted_new" })
      .get(),
  ).toHaveLength(1);
});
test("rollback removes both contact and accepted fact", async () => {
  const email = `${crypto.randomUUID()}@example.test`;
  let id = "";
  await expect(
    runInTransaction(async () => {
      id = (await store.accept(email)).id;
      throw new Error("controlled rollback");
    }),
  ).rejects.toThrow("controlled rollback");
  expect(await WorksheetContact.query().where({ email }).get()).toHaveLength(0);
  expect(
    await WorksheetEvent.query().where({ acceptance_id: id }).get(),
  ).toHaveLength(0);
});
test("resource access requires committed contact and is a separate deduplicated fact", async () => {
  await expect(store.open(crypto.randomUUID())).rejects.toThrow(
    "Acceptance not found",
  );
  const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
  await Promise.all(Array.from({ length: 4 }, () => store.open(accepted.id)));
  const contact = (await WorksheetContact.find(accepted.id))!;
  expect(await contact.events().where({ kind: "accepted_new" }).count()).toBe(1);
  expect(await contact.events().where({ kind: "resource_open" }).count()).toBe(1);
});

test("failed worksheet rendering does not record successful resource access", async () => {
  const { ViewRenderer, EtaViewEngine } = await import("@getstrata/core/view");
  const { temporarySignedUrl } = await import("@getstrata/core/http/signedUrl");
  const { WorksheetController } =
    await import("../../src/modules/worksheet/controller");
  const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
  const views = new ViewRenderer(
    new EtaViewEngine("/private/tmp/clientelo-missing-view-fixture"),
  );
  const controller = new WorksheetController(views, store);
  const request = new Request(
    new URL(
      temporarySignedUrl("/controlled/worksheet", 600, {
        acceptance: accepted.id,
      }),
      process.env.APP_URL!,
    ),
  );
  await expect(controller.resource(request)).rejects.toThrow();
  expect(
    await WorksheetEvent.query()
      .where({ acceptance_id: accepted.id, kind: "resource_open" })
      .get(),
  ).toHaveLength(0);
});

test("hosted qualification policy can use the same store without a local database-name restriction", async () => {
  // ORM stays bound to the isolated PostgreSQL fixture, not this synthetic hosted URL.
  const { controlledWorksheetEnabled } =
    await import("../../src/modules/worksheet/measurement");
  const hosted = {
    APP_PROFILE: "worksheet-qualification",
    APP_ENV: "production",
    RENDER: "true",
    RENDER_EXTERNAL_URL: "https://clientelo-experiment.onrender.com",
    WORKSHEET_CONTROLLED_TESTS: "1",
    APP_URL: "https://clientelo-experiment.onrender.com",
    CSRF_TARGET_ORIGIN: "https://clientelo-experiment.onrender.com",
    DATABASE_URL:
      "postgres://clientelo_native_app:synthetic@fixture-pooler.eu-central-1.aws.neon.tech/clientelo_native",
  };
  expect(controlledWorksheetEnabled(hosted)).toBe(true);
  const old = process.env.DATABASE_URL;
  process.env.DATABASE_URL = hosted.DATABASE_URL;
  try {
    const accepted = await store.accept(`${crypto.randomUUID()}@example.test`);
    expect(await WorksheetContact.find(accepted.id)).not.toBeNull();
  } finally {
    process.env.DATABASE_URL = old;
  }
});

test("contact, canonical accepted fact and journey attribution roll back together", async () => {
  const { WorksheetJourneyEvent } =
    await import("../../src/models/WorksheetJourneyEvent");
  const journey = { id: crypto.randomUUID(), variant: "a" as const };
  const email = crypto.randomUUID() + "@example.test";
  await expect(
    runInTransaction(async () => {
      await store.accept(email, "a", journey);
      throw new Error("rollback all acceptance facts");
    }),
  ).rejects.toThrow("rollback all acceptance facts");
  expect(await WorksheetContact.query().where({ email }).get()).toHaveLength(0);
  expect(
    await WorksheetJourneyEvent.query().where({ journey_id: journey.id }).get(),
  ).toHaveLength(0);
});

test("expired retained identity cannot produce a misleading renewed acceptance before pruning", async () => {
  const email = crypto.randomUUID() + "@example.test";
  const accepted = await store.accept(email);
  await WorksheetContact.repository().query().where({ id: accepted.id }).update({ created_at: new Date(Date.now() - 8 * 86400000) });
  await expect(store.accept(email)).rejects.toThrow("expired");
});
