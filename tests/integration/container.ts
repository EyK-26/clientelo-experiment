import { localTestUrl } from "../support/database";
// Real production-image checks on owned local fixtures. Never use hosted credentials here.
import { SQL } from "bun";
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import migration from "../support/controlled-worksheet/migration";
const database = new URL(localTestUrl("DATABASE_URL"));
const ownerUrl = new URL(localTestUrl("MIGRATION_DATABASE_URL"));
assert.equal(database.pathname, "/clientelo_native_test");
assert.equal(ownerUrl.pathname, database.pathname);
assert(["127.0.0.1", "localhost"].includes(database.hostname));
const owner = new SQL(ownerUrl.href);
const image = "investicni-prehled:demo";
const dir = mkdtempSync(join(tmpdir(), "clientelo-product-container-"));
const name = "investicni-prehled-check-" + crypto.randomUUID().slice(0, 8);
let step = "schema";
let schemaReady = false;
function docker(...args: string[]) {
  const result = Bun.spawnSync(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode) throw new Error("Docker operation failed at " + step);
  return result.stdout.toString().trim();
}
const base = "http://127.0.0.1:4337";
const host = "native.clientelo.test";
const get = (path: string) => fetch(base + path, { headers: { Host: host } });
async function start(controlled: boolean) {
  database.hostname = "host.docker.internal";
  const values = {
    APP_PROFILE: "worksheet-qualification",
    APP_ENV: controlled ? "test" : "production",
    APP_DEBUG: "false",
    APP_URL: "https://" + host,
    CSRF_TARGET_ORIGIN: "https://" + host,
    HOST: "0.0.0.0",
    PORT: "3000",
    DATABASE_URL: database.href,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    WORKSHEET_CONTROLLED_TESTS: controlled ? "1" : "0",
    WORKSHEET_PUBLIC_COLLECTION: "0",
    AUTH_DEV_HEADERS: "false",
    TENANT_DEV_HEADERS: "false",
    FEATURE_REGISTRATION: "false",
  };
  const env = join(dir, "runtime.env");
  writeFileSync(
    env,
    Object.entries(values)
      .map(([k, v]) => k + "=" + v)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  docker(
    "run",
    "-d",
    "--name",
    name,
    "--env-file",
    env,
    "-p",
    "127.0.0.1:4337:3000",
    image,
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await get("/health")).status === 200) return;
    } catch { }
    await Bun.sleep(250);
  }
  throw new Error("Container health not ready");
}
async function form() {
  const response = await get("/etf");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert(html.includes("Ukázka pro hodnocení"));
  assert(html.replace(/\s+/g, " ").includes("není připravena pro reklamní provoz"));
  return {
    token: html.match(/name="_token" value="([^"]+)"/)![1]!,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
    action: html
      .match(/<form method="post" action="([^"]+)"/)![1]!
      .replaceAll("&amp;", "&"),
  };
}
async function submit(
  current: Awaited<ReturnType<typeof form>>,
  email: string,
  token = current.token,
) {
  return fetch(new URL(current.action, base), {
    method: "POST",
    headers: { Host: host, Origin: "https://" + host, Cookie: current.cookie },
    body: new URLSearchParams({ _token: token, email }),
  });
}
try {
  await migration.up(owner);
  schemaReady = true;
  await owner.unsafe(
    "GRANT SELECT,INSERT,UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
  );
  step = "production closed profile";
  await start(false);
  const preview = await get("/etf");
  assert.equal(preview.status, 200);
  assert(!(await preview.text()).includes("<form"));
  assert.equal(preview.headers.getSetCookie().length, 0);
  assert.equal((await get("/worksheet")).status, 404);
  const metadata = JSON.parse(
    docker(
      "exec",
      name,
      "bun",
      "-e",
      "console.log(JSON.stringify({bun:Bun.version,core:(await Bun.file('node_modules/@getstrata/core/package.json').json()).version,uid:process.getuid()}))",
    ),
  );
  assert.equal(metadata.bun, "1.4.4");
  assert.equal(metadata.core, "2.2.59");
  assert.notEqual(metadata.uid, 0);
  const config = JSON.parse(docker("inspect", name))[0];
  const envKeys = config.Config.Env.map((line: string) => line.split("=")[0]);
  for (const key of [
    "MIGRATION_DATABASE_URL",
    "RETENTION_DATABASE_URL",
    "RENDER_API_KEY",
    "RESEND_API_KEY",
  ])
    assert(!envKeys.includes(key));
  assert(!envKeys.some((key: string) => /^(MAIL_|RESEND_|RESOURCE_MAIL_|TEST_RECIPIENT_)/.test(key)));
  assert.equal(docker("exec", name, "find", "/app", "-name", ".env*"), "");
  const excluded = JSON.parse(docker(
    "exec", name, "bun", "-e",
    "console.log(JSON.stringify(['.private','docs','ads','ai-log','output','tests','checks','scripts'].map(p=>require('node:fs').existsSync('/app/'+p))))",
  ));
  assert(excluded.every((present: boolean) => !present));
  docker("rm", "-f", name);
  step = "controlled native journey";
  await start(true);
  for (const path of ["/resource/checklist", "/assets/site.css", "/assets/htmx.min.js"])
    assert.equal((await get(path)).status, 404);
  for (const path of [
    "/assets/etf.css",
    "/assets/worksheet-form.js",
    "/assets/worksheet-events.js",
    "/assets/worksheet-print.js",
  ])
    assert.equal((await get(path)).status, 200);
  const current = await form();
  assert.equal((await submit(current, "invalid")).status, 422);
  assert.equal(
    (await submit(current, "container@example.test", "invalid")).status,
    403,
  );
  const accepted = await submit(current, "container@example.test");
  assert.equal(accepted.headers.get("X-Worksheet-New"), "1");
  const link = (await accepted.text())
    .match(/id="worksheet-access" href="([^"]+)"/)![1]!
    .replaceAll("&amp;", "&");
  const resource = await get(link);
  assert.equal(resource.status, 200);
  const resourceHtml = await resource.text();
  assert(resourceHtml.includes("Šest otázek pro brokera"));
  assert(resourceHtml.includes("po uložení ukázkové žádosti"));
  for (const response of await Promise.all(
    Array.from({ length: 4 }, () => submit(current, "container@example.test")),
  ))
    assert.equal(response.headers.get("X-Worksheet-New"), "0");
  docker("rm", "-f", name);
  step = "new application container";
  await start(true);
  const repeated = await submit(await form(), "container@example.test");
  assert.equal(repeated.headers.get("X-Worksheet-New"), "0");
  assert.equal((await get("/views/etf-worksheet.eta")).status, 404);
  console.log(
    JSON.stringify({
      image,
      ...metadata,
      production_closed_preview: true,
      generated_native_boot: true,
      assets_and_templates: true,
      invalid_input_422: true,
      invalid_csrf_403: true,
      committed_acceptance_and_signed_resource: true,
      concurrent_duplicates_suppressed: true,
      persistence_after_new_container: true,
      administration_credentials_absent: true,
      mail_configuration_absent: true,
      retired_email_routes_and_assets_absent: true,
      migrations_at_startup: false,
      email_sends: 0,
      hosted_cold_qualification: "unproven",
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      container_check: "failed",
      step,
      error: error instanceof Error ? error.name : "unknown",
      details_withheld: true,
    }),
  );
  process.exitCode = 1;
} finally {
  Bun.spawnSync(["docker", "rm", "-f", name], {
    stdout: "ignore",
    stderr: "ignore",
  });
  if (schemaReady) await migration.down!(owner);
  await owner.close();
  rmSync(dir, { recursive: true, force: true });
}
