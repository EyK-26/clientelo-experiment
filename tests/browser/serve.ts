import { localTestUrl } from "../support/database";
// Local synthetic test harness, never copied to a deployment image.
import { SQL } from "bun";
import migration from "../support/controlled-worksheet/migration";
const ownerUrl = localTestUrl("MIGRATION_DATABASE_URL");
localTestUrl("DATABASE_URL");
if (new URL(ownerUrl).pathname !== "/clientelo_native_test")
  throw new Error("Owned native_test only");
const owner = new SQL(ownerUrl);
await migration.up(owner);
await owner.unsafe(
  "GRANT SELECT, INSERT, UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO clientelo_native_runtime",
);
delete process.env.MIGRATION_DATABASE_URL;
Object.assign(process.env, {
  APP_ENV: "test",
  APP_URL: "http://127.0.0.1:4335",
  CSRF_TARGET_ORIGIN: "http://127.0.0.1:4335",
  WORKSHEET_CONTROLLED_TESTS: "1",
});
Object.assign(process.env, { APP_PROFILE: "worksheet-qualification" });
const { bootstrapApp, createAppServer } =
  await import("../../src/bootstrap/createApp");
const { closeDatabase } = await import("../../src/bootstrap/database");
const { WORKSHEET_STORE } = await import("../../src/modules/worksheet");
const app = await bootstrapApp({ migrate: false });
if (process.argv.includes("--delayed")) {
  const store = app.context.dependencies.container.resolve(WORKSHEET_STORE);
  const accept = store.accept.bind(store);
  let first = true;
  store.accept = async (...args: Parameters<typeof accept>) => {
    if (!first) return accept(...args);
    first = false;
    await Bun.sleep(12000);
    await accept(...args);
    throw new Error("Controlled lost response after commit");
  };
}
const server = createAppServer(app.routes, 4335, undefined, {
  hostname: "127.0.0.1",
});
console.log(
  "Controlled loopback form ready: http://127.0.0.1:4335/etf; synthetic addresses only; no mail.",
);
let closing = false;
async function cleanup() {
  if (closing) return;
  closing = true;
  await server.stop(true);
  await app.context.dispose();
  await closeDatabase();
  await migration.down!(owner);
  await owner.close();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
