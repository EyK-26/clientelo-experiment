import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDatabase } from "../../src/bootstrap/database";
import { WorksheetContact } from "../../src/models/WorksheetContact";
import { worksheetFixture } from "../support/worksheet";

test("worksheet TLS termination preserves host admission and native CSRF without an adapter", async () => {
  const fixture = await worksheetFixture();
  delete process.env.MIGRATION_DATABASE_URL;
  Object.assign(process.env, {
    APP_PROFILE: "worksheet-qualification", APP_ENV: "test",
    APP_URL: "https://native.clientelo.test", CSRF_TARGET_ORIGIN: "https://native.clientelo.test",
    WORKSHEET_CONTROLLED_TESTS: "1",
  });
  const { bootstrapApp, createAppServer } = await import("../../src/bootstrap/createApp");
  const dir = mkdtempSync(join(tmpdir(), "clientelo-worksheet-tls-"));
  const generated = Bun.spawnSync([
    "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
    "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1",
  ]);
  expect(generated.exitCode).toBe(0);
  const app = await bootstrapApp({ migrate: false });
  const backend = createAppServer(app.routes, 0, undefined, { hostname: "127.0.0.1" });
  // Routes use the owned local fixture; exercise production cookie policy over real TLS.
  // Production startup/closed collection is checked separately in the container.
  process.env.APP_ENV = "production";
  delete process.env.MIGRATION_DATABASE_URL;
  const edge = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    tls: { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
    async fetch(request) {
      const url = new URL(request.url);
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Proto", "https");
      return fetch(new URL(url.pathname + url.search, backend.url), {
        method: request.method, headers,
        body: request.method === "POST" ? await request.arrayBuffer() : undefined, redirect: "manual",
      });
    },
  });
  const host = "native.clientelo.test";
  const client = (path: string, init: RequestInit = {}) => fetch(new URL(path, edge.url), {
    ...init, tls: { ca: readFileSync(join(dir, "cert.pem"), "utf8") },
    headers: { Host: host, ...init.headers }, redirect: "manual",
  });
  try {
    const page = await client("/etf");
    expect(page.status).toBe(200);
    const html = await page.text();
    const token = html.match(/name="_token" value="([^"]+)"/)![1]!;
    const cookie = page.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const action = html.match(/<form method="post" action="([^"]+)"/)![1]!.replaceAll("&amp;", "&");
    expect(page.headers.getSetCookie().join(";")).toContain("Secure");
    expect(page.headers.get("Cache-Control")).toContain("no-store");
    const post = (origin: string, email = "invalid", submitted = token) => client(action, {
      method: "POST", headers: { Cookie: cookie, Origin: origin },
      body: new URLSearchParams({ _token: submitted, email }),
    });
    expect((await post("https://" + host)).status).toBe(422);
    expect((await post("https://" + host, "fixture@example.test", "wrong")).status).toBe(403);
    expect((await post("https://attacker.example.test")).status).toBe(403);
    expect((await client("/etf", { headers: { Host: "attacker.example.test", "X-Forwarded-Host": host } })).status).toBe(403);
    expect(await WorksheetContact.query().get()).toHaveLength(0);
    // Target-origin validation admits matching authority; it does not authenticate proxy peers.
    expect((await fetch(new URL("/etf", backend.url), { headers: { Host: host } })).status).toBe(200);
    const accepted = await post("https://" + host, "tls@example.test");
    expect(accepted.headers.get("X-Worksheet-New")).toBe("1");
    const link = (await accepted.text()).match(/id="worksheet-access" href="([^"]+)"/)![1]!.replaceAll("&amp;", "&");
    expect((await client(link)).status).toBe(200);
    expect((await post("https://" + host, "tls@example.test")).headers.get("X-Worksheet-New")).toBe("0");
    expect(await WorksheetContact.query().get()).toHaveLength(1);
  } finally {
    await edge.stop(true);
    await backend.stop(true);
    await app.context.dispose();
    await closeDatabase();
    await fixture.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
