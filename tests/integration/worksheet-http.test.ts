import { localTestUrl } from "../support/database";
import { test, expect } from "bun:test";
import { SQL } from "bun";
import migration from "../support/controlled-worksheet/migration";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { WorksheetEvent } from "../../src/models/WorksheetEvent";
import { closeDatabase } from "../../src/bootstrap/database";
test("controlled native form requires CSRF and committed acceptance before worksheet access", async () => {
  const owner = new SQL(localTestUrl("MIGRATION_DATABASE_URL"));
  if (new URL(localTestUrl("DATABASE_URL")).pathname !== "/clientelo_native_test")
    throw new Error("Owned native_test only");
  await migration.up(owner);
  await owner.unsafe(
    "GRANT SELECT, INSERT, UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  delete process.env.MIGRATION_DATABASE_URL;
  Object.assign(process.env, {
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
    expect((await get("/controlled/worksheet")).status).toBe(403);
    const page = await get(
      "/controlled/contact?utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
    );
    expect(page.status).toBe(200);
    const html = await page.text();
    const token = html.match(/name="_token" value="([^"]+)"/)![1]!;
    const cookie = page.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    const action = html
      .match(/<form method="post" action="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    const post = (email: string, csrf = token) =>
      fetch(new URL(action, server.url), {
        method: "POST",
        headers: { Host: host, Origin: "https://" + host, Cookie: cookie },
        body: new URLSearchParams({ _token: csrf, email }),
      });
    const invalid = await post("bad");
    expect(invalid.status).toBe(422);
    expect(await invalid.text()).toContain('value="bad"');
    expect((await post("fixture@example.test", "wrong")).status).toBe(403);
    const changed = new URL(action, server.url);
    changed.searchParams.set("ad_variant", "b");
    expect(
      (
        await fetch(changed, {
          method: "POST",
          headers: { Host: host, Origin: "https://" + host, Cookie: cookie },
          body: new URLSearchParams({
            _token: token,
            email: "tampered@example.test",
          }),
        })
      ).status,
    ).toBe(403);
    expect(await WorksheetContact.query().get()).toHaveLength(0);
    const response = await post("fixture@example.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Worksheet-Accepted")).toBe("1");
    const accepted = await response.text();
    const path = accepted
      .match(/id="worksheet-access" href="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    expect(
      await WorksheetEvent.query().where({ kind: "accepted_new" }).get(),
    ).toHaveLength(1);
    expect(
      await WorksheetEvent.query().where({ kind: "resource_open" }).get(),
    ).toHaveLength(0);
    expect((await get("/assets/worksheet-print.js")).status).toBe(200);
    const resource = await get(path);
    expect(resource.status).toBe(200);
    expect(await resource.text()).toContain("Šest otázek pro brokera");
    expect(resource.headers.get("Cache-Control")).toBe("no-store");
    const tampered = new URL(path, "https://" + host);
    tampered.searchParams.set("acceptance", crypto.randomUUID());
    expect((await get(tampered.pathname + tampered.search)).status).toBe(403);
    const repeats = await Promise.all(
      Array.from({ length: 4 }, () => post("fixture@example.test")),
    );
    for (const repeat of repeats) expect(repeat.status).toBe(200);
    expect(await WorksheetContact.query().get()).toHaveLength(1);
    expect(
      await WorksheetEvent.query().where({ kind: "accepted_new" }).get(),
    ).toHaveLength(1);
    expect(
      await WorksheetEvent.query().where({ kind: "resource_open" }).get(),
    ).toHaveLength(1);
  } finally {
    await server.stop(true);
    await app.context.dispose();
    await closeDatabase();
    await migration.down!(owner);
    await owner.close();
  }
});
