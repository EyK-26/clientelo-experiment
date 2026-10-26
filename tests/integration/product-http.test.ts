import { localTestUrl } from "../support/database";
import { WorksheetJourneyEvent } from "../../src/models/WorksheetJourneyEvent";
import { test, expect, spyOn } from "bun:test";
import { SQL } from "bun";
import migration from "../support/controlled-worksheet/migration";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { WorksheetStore } from "../../src/modules/worksheet/store";
import { closeDatabase } from "../../src/bootstrap/database";

test("generated native application connects comparison, guarded contact, recovery and signed worksheet", async () => {
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  if (new URL(localTestUrl("DATABASE_URL")).pathname !== "/clientelo_native_test")
    throw new Error("Owned isolated test DB only");
  await migration.up(owner);
  await owner.unsafe(
    "GRANT SELECT, INSERT, UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  delete process.env.MIGRATION_DATABASE_URL;
  Object.assign(process.env, {
    APP_PROFILE: "worksheet-qualification",
    APP_ENV: "test",
    APP_URL: "https://native.clientelo.test",
    CSRF_TARGET_ORIGIN: "https://native.clientelo.test",
    WORKSHEET_CONTROLLED_TESTS: "1",
  });
  const { bootstrapApp, createAppServer } =
    await import("../../src/bootstrap/createApp");
  const app = await bootstrapApp({ migrate: false });
  const server = createAppServer(app.routes, 0, undefined, {
    hostname: "127.0.0.1",
  });
  const host = "native.clientelo.test";
  const get = (path: string) =>
    fetch(new URL(path, server.url), { headers: { Host: host } });
  try {
    const page = await get(
      "/etf?utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
    );
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("SPY a VOO: stejný index. Co porovnat dál?");
    expect(html).toContain("Ukázka pro hodnocení");
    expect(html.replace(/\s+/g, " ")).toContain("není připravena pro reklamní provoz");
    expect(html).toContain('name="email"');
    expect(
      await WorksheetJourneyEvent.query()
        .where({ kind: "page_response_ready" })
        .get(),
    ).toHaveLength(1);
    expect(html).toContain("Šest otázek");
    const token = html.match(/name="_token" value="([^"]+)"/)![1]!;
    const cookie = page.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    const action = html
      .match(/<form method="post" action="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    expect((await get(action.split("#")[0]!)).status).toBe(200);
    expect(
      await WorksheetJourneyEvent.query()
        .where({ kind: "page_response_ready" })
        .get(),
    ).toHaveLength(1);
    const eventUrl = html
      .match(/data-journey-events="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    const eventPost = (kind: string, extraEmail = false) => {
      const body = new URLSearchParams({ _token: token, kind });
      if (extraEmail) body.set("email", "not-analytics@example.test");
      return fetch(new URL(eventUrl, server.url), {
        method: "POST",
        headers: { Host: host, Origin: "https://" + host, Cookie: cookie },
        body,
      });
    };
    expect((await eventPost("accepted_new")).status).toBe(422);
    expect((await eventPost("form_engaged", true)).status).toBe(422);
    expect((await eventPost("form_engaged")).status).toBe(204);
    const post = (email: string, csrf = token, extra = false) => {
      const body = new URLSearchParams({ _token: csrf, email });
      if (extra) body.append("email", email);
      return fetch(new URL(action, server.url), {
        method: "POST",
        headers: { Host: host, Origin: "https://" + host, Cookie: cookie },
        body,
      });
    };
    expect((await post("real-shaped@example.org")).status).toBe(422);
    expect((await post("fixture@example.test", token, true)).status).toBe(422);
    expect((await post("fixture@example.test", "wrong")).status).toBe(403);
    expect(await WorksheetContact.query().get()).toHaveLength(0);
    const failure = spyOn(
      WorksheetStore.prototype,
      "accept",
    ).mockRejectedValueOnce(new Error("controlled unavailable DB"));
    const failed = await post("fixture@example.test");
    const failedHtml = await failed.text();
    failure.mockRestore();
    expect(failed.status).toBe(503);
    expect(failedHtml).toContain('value="fixture@example.test"');
    expect(failedHtml).not.toContain('id="worksheet-access"');
    const accepted = await post("fixture@example.test");
    expect(accepted.headers.get("X-Worksheet-Accepted")).toBe("1");
    const confirmation = await accepted.text();
    expect(confirmation).not.toContain("fixture@example.test");
    const link = confirmation
      .match(/id="worksheet-access" href="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    expect(link).not.toContain("@");
    const resource = await get(link);
    expect(resource.status).toBe(200);
    const resourceHtml = await resource.text();
    expect(resourceHtml).toContain("Tisk / uložit do PDF");
    expect(resourceHtml).toContain("po uložení ukázkové žádosti");
    const repeats = await Promise.all(
      Array.from({ length: 4 }, () => post("fixture@example.test")),
    );
    for (const r of repeats) expect(r.status).toBe(200);
    expect(await WorksheetContact.query().get()).toHaveLength(1);
    expect(
      await WorksheetEvent.query().where({ kind: "accepted_new" }).get(),
    ).toHaveLength(1);
    for (const kind of [
      "page_response_ready",
      "form_engaged",
      "submit_attempt",
      "lead_rejected",
      "request_rejected",
      "accepted_new",
      "duplicate_recovered",
      "resource_response_ready",
    ] as const)
      expect(
        await WorksheetJourneyEvent.query().where({ kind }).get(),
      ).toHaveLength(1);
    expect(
      JSON.stringify(await WorksheetJourneyEvent.query().get()),
    ).not.toContain("@");
    const now = spyOn(Date, "now").mockReturnValue(Date.now() + 601000);
    const expired = await get(link);
    now.mockRestore();
    expect(expired.status).toBe(403);
    expect(await expired.text()).toContain("Získat nový odkaz");
    expect((await get("/worksheet")).status).toBe(403);
  } finally {
    await server.stop(true);
    await app.context.dispose();
    await closeDatabase();
    await migration.down!(owner);
    await owner.close();
  }
});
