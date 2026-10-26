import { expect, test } from "bun:test";
import { closeDatabase } from "../../src/bootstrap/database";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { worksheetFixture } from "../support/worksheet";

test("worksheet HTTP rejects malformed hosts, CSRF and repeated/file fields before persistence", async () => {
  const fixture = await worksheetFixture();
  delete process.env.MIGRATION_DATABASE_URL;
  Object.assign(process.env, {
    APP_PROFILE: "worksheet-qualification",
    APP_ENV: "test",
    APP_URL: "https://native.clientelo.test",
    CSRF_TARGET_ORIGIN: "https://native.clientelo.test",
    WORKSHEET_CONTROLLED_TESTS: "1",
  });
  const { bootstrapApp, createAppServer } = await import("../../src/bootstrap/createApp");
  const app = await bootstrapApp({ migrate: false });
  const server = createAppServer(app.routes, 0, undefined, { hostname: "127.0.0.1" });
  const host = "native.clientelo.test";
  const get = (path: string, headers: Record<string, string> = {}) =>
    fetch(new URL(path, server.url), {
      headers: { Host: host, ...headers }, redirect: "manual",
    });
  try {
    for (const path of ["/health", "/assets/etf.css"])
      expect((await get(path)).status).toBe(200);
    const preview = await get("/etf-preview");
    expect(preview.status).toBe(200);
    const previewHtml = await preview.text();
    expect(previewHtml).toContain("SPY a VOO: stejný index. Co porovnat dál?");
    expect(previewHtml).not.toContain("<form");
    expect(previewHtml).not.toContain('href="worksheet.html"');
    expect(preview.headers.getSetCookie()).toHaveLength(0);
    const page = await get("/etf");
    expect(page.status).toBe(200);
    const html = await page.text();
    const token = html.match(/name="_token" value="([^"]+)"/)?.[1];
    expect(token).toBeDefined();
    const cookie = page.headers.getSetCookie()
      .map(value => value.split(";")[0]).join("; ");
    const action = html.match(/<form method="post" action="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&");
    const post = (email: string[], options: {
      token?: string;
      omitToken?: boolean;
      origin?: string;
      omitOrigin?: boolean;
    } = {}) => {
      const body = new URLSearchParams();
      for (const value of email) body.append("email", value);
      if (!options.omitToken) body.set("_token", options.token ?? token!);
      return fetch(new URL(action, server.url), {
        method: "POST",
        headers: {
          Host: host, Cookie: cookie,
          ...(options.omitOrigin ? {} : { Origin: options.origin ?? "https://" + host }),
          "X-Forwarded-Host": host, "X-Forwarded-Proto": "https",
        },
        body,
      });
    };
    expect((await get("/")).status).toBe(302);
    expect((await get("/resource/checklist")).status).toBe(404);
    for (const path of ["/worksheets", "/api/v1/worksheets"])
      expect((await get(path)).status).toBe(404);
    const wrongHost = await get("/etf", {
      Host: "attacker.example.test", "X-Forwarded-Host": host,
    });
    expect(wrongHost.status).toBe(403);
    expect(wrongHost.headers.getSetCookie()).toHaveLength(0);
    const beforeInvalid = (await WorksheetContact.query().get())
      .map(row => row.toObject().id).sort();
    const invalid = await post(["invalid"]);
    expect(invalid.status).toBe(422);
    expect(await invalid.text()).toContain('aria-invalid="true"');
    expect((await post(["real-shaped@example.org"])).status).toBe(422);
    expect((await post(["fixture@example.test", "fixture@example.test"])).status).toBe(422);
    expect((await post(["fixture@example.test"], { omitToken: true })).status).toBe(403);
    expect((await post(["fixture@example.test"], { token: "bad" })).status).toBe(403);
    for (const origin of [
      "https://attacker.example.test", "null", "https://" + host + "/path", "http://" + host,
    ]) expect((await post(["fixture@example.test"], { origin })).status).toBe(403);
    expect((await post(["fixture@example.test"], { omitOrigin: true })).status).toBe(403);
    expect((await get("/etf", { Host: "user@" + host })).status).toBe(400);
    expect((await get("/etf", { Host: host + ":8443" })).status).toBe(403);
    const body = new URLSearchParams({ _token: token!, email: "invalid" });
    expect((await fetch(new URL(action, server.url), {
      method: "POST", headers: { Host: host, Origin: "https://" + host }, body,
    })).status).toBe(403);
    const otherPage = await get("/etf");
    const otherCookie = otherPage.headers.getSetCookie()
      .map(value => value.split(";")[0]).join("; ");
    expect((await fetch(new URL(action, server.url), {
      method: "POST",
      headers: { Host: host, Origin: "https://" + host, Cookie: otherCookie }, body,
    })).status).toBe(403);
    const multipart = new FormData();
    multipart.set("_token", token!);
    multipart.set("email", new File(["not a mailbox"], "mailbox.txt"));
    const upload = () => fetch(new URL(action, server.url), {
      method: "POST", headers: { Host: host, Origin: "https://" + host, Cookie: cookie },
      body: multipart,
    });
    expect((await upload()).status).toBe(422);
    multipart.append("email", "fixture@example.test");
    expect((await upload()).status).toBe(422);
    expect((await WorksheetContact.query().get()).map(row => row.toObject().id).sort())
      .toEqual(beforeInvalid);
  } finally {
    await server.stop(true);
    await app.context.dispose();
    await closeDatabase();
    await fixture.close();
  }
});
